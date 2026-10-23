import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
import django
django.setup()
from rest_framework import serializers as s
from accounts.portfolio_views import VersionedAction, ExampleInput, ExampleEditInput, DecisionInput
from catalog.workspace import DraftInput, ExtraInput, PublicServiceV2Serializer
from catalog.serializers import ServiceSerializer
from orders.workspace import QuoteInput, PurchaseInput
from orders.serializers import OrderSerializer
from conversations.views import MessageInput, AppealInput, SecurityDecisionInput, DiscussionInput

root = Path(__file__).resolve().parents[3]
schemas = {}
def schema(field):
    if isinstance(field, s.ListSerializer):
        return {'type': 'array', 'items': schema(field.child)}
    if isinstance(field, s.Serializer):
        props = {name: schema(value) for name, value in field.fields.items()}
        value = {'type': 'object', 'properties': props, 'additionalProperties': False}
        required = [name for name, value in field.fields.items() if value.required]
        if required: value['required'] = required
        return value
    if isinstance(field, s.ListField):
        value = {'type': 'array', 'items': schema(field.child)}
        if field.max_length is not None: value['maxItems'] = field.max_length
        return value
    if isinstance(field, s.ChoiceField):
        return {'type': 'string', 'enum': list(field.choices)}
    if isinstance(field, s.DecimalField):
        return {'type': 'string', 'pattern': r'^\d+\.\d{2}$', 'description': 'Десятичная сумма или процент строкой, без float расчётов.'}
    if isinstance(field, s.IntegerField):
        value = {'type': 'integer', 'format': 'int64'}
        for src, dest in [('min_value', 'minimum'), ('max_value', 'maximum')]:
            if getattr(field, src, None) is not None: value[dest] = getattr(field, src)
        return value
    if isinstance(field, s.BooleanField): return {'type': 'boolean'}
    if isinstance(field, s.UUIDField): return {'type': 'string', 'format': 'uuid'}
    if isinstance(field, s.CharField):
        value = {'type': 'string', 'minLength': 0 if field.allow_blank else 1}
        if field.max_length is not None: value['maxLength'] = field.max_length
        return value
    return {}

for name, cls in {'Version': VersionedAction, 'ExampleInput': ExampleInput, 'ExampleEditInput': ExampleEditInput,
                  'Decision': DecisionInput, 'Draft': DraftInput, 'Extra': ExtraInput, 'Service': ServiceSerializer,
                  'Service2': PublicServiceV2Serializer, 'QuoteInput': QuoteInput, 'PurchaseInput': PurchaseInput,
                  'Order': OrderSerializer, 'MessageInput': MessageInput, 'AppealInput': AppealInput,
                  'SecurityDecision': SecurityDecisionInput, 'DiscussionInput': DiscussionInput}.items(): schemas[name] = schema(cls())

def ref(name): return {'$ref': '#/components/schemas/'+name}
def obj(properties, required=None): return {'type':'object','properties':properties,'required':required or list(properties),'additionalProperties':False}
def text(nullable=False): return {'type':'string', **({'nullable':True} if nullable else {})}
def integer(): return {'type':'integer','format':'int64'}
def boolean(): return {'type':'boolean'}
def array(item): return {'type':'array','items':item}
def page(item, cursor=False):
    props={'next':text(True),'previous':text(True),'results':item}
    if not cursor: props['count']=integer()
    return obj(props)

schemas['Empty']=obj({})
schemas['Error']={'type':'object','additionalProperties':True,'description':'DRF detail либо ошибки полей; code не гарантирован.'}
schemas['Moderation']=obj({'user_id':integer(),'revision':integer(),'status':{'type':'string','enum':['draft','pending','approved','rejected','changes']},
    'reason':text(),'submitted_at':text(True),'ready_to_submit':boolean(),'missing_fields':array(text()),'approved':boolean()})
schemas['Example']=obj({'id':{'type':'string','format':'uuid'},'title':text(),'kind':{'type':'string','enum':['link','file']},'url':text(True),
    'content_url':text(True),'content_type':text(True),'size':integer(),'created_at':text()})
schemas['ExampleMutation']=obj({'example':ref('Example'),'moderation':ref('Moderation')})
schemas['ExampleDelete']=obj({'moderation':ref('Moderation')})
schemas['ExampleJson']=json.loads(json.dumps(schemas['ExampleInput']))
schemas['ExampleJson']['required'].append('url')
schemas['ExampleMultipart']=json.loads(json.dumps(schemas['ExampleInput']))
schemas['ExampleMultipart']['properties']['file']={'type':'string','format':'binary','description':'PNG/JPEG/WebP/PDF <= 10 МиБ по содержимому'}
schemas['ExampleMultipart']['oneOf']=[{'required':['url'],'not':{'required':['file']}},{'required':['file'],'not':{'required':['url']}}]
schemas['Service2']['properties']['extras']=array(ref('Extra'))
schemas['OwnService2']=json.loads(json.dumps(schemas['Service2']))
schemas['OwnService2']['properties'].update(status={'type':'string','enum':['draft','pending','published','rejected','changes']},reason=text(),portfolio_example_ids=array({'type':'string','format':'uuid'}))
schemas['Quote']=obj({'quote_id':{'type':'string','format':'uuid'},'service_id':integer(),'service_revision':integer(),'performer_id':integer(),
    'title':text(),'description':text(),'included':array(text()),'currency':{'type':'string','enum':['RUB']},'duration_days':integer(),'tariff_code':text(),
    'base_price_amount':text(),'selected_extras':array(ref('Extra')),'extras_amount':text(),'price_amount':text(),
    'buyer_fee_percent':text(),'buyer_fee_amount':text(),'total_amount':text()})
schemas['Order2']=json.loads(json.dumps(schemas['Order']))
schemas['Order2']['properties'].update(revision=integer(),tariff_code=text(),base_price_amount=text(),selected_extras=array(ref('Extra')),
    quote_id={'type':'string','format':'uuid','nullable':True},available_actions=array({'type':'string','enum':['accept','cancel','decline']}),payment_status={'type':'string','enum':['unpaid']})
for name in ('Order','Order2'):
    schemas[name]['properties']['closed_by']={'allOf':[schemas[name]['properties']['closed_by']],'nullable':True}
    for date_name in ('created_at','accepted_at','closed_at'):
        schemas[name]['properties'][date_name]={'type':'string','format':'date-time',**({'nullable':True} if date_name!='created_at' else {})}
schemas['Conversation']=obj({'id':{'type':'string','format':'uuid'},'order_id':integer(),'participant_ids':array(integer()),'created_at':text()})
schemas['Conversation']['properties'].update(order_id={'type':'integer','format':'int64','nullable':True},kind={'type':'string','enum':['order','discussion']},service_id=integer(),title=text())
schemas['Conversation']['required'] += ['kind','service_id','title']
schemas['Message']=obj({'id':integer(),'sequence':integer(),'conversation_id':{'type':'string','format':'uuid'},'sender_id':integer(),'client_message_id':{'type':'string','format':'uuid'},
    'text':text(),'status':{'type':'string','enum':['stored','held']},'categories':array(text()),'rules_version':text(),'warning':text(True),
    'security_case_id':{'type':'integer','nullable':True},'created_at':text()})
schemas['Case']=obj({'id':integer(),'message_id':integer(),'conversation_id':text(),'revision':integer(),'categories':array(text()),'rules_version':text(),
    'appealed':boolean(),'appeal_reason':text(),'decision':{'type':'string','enum':['release','keep'],'nullable':True},'decision_reason':text()})
schemas['CaseDetail']=json.loads(json.dumps(schemas['Case']))
schemas['CaseDetail']['properties']['message']=ref('Message')
schemas['Event']=obj({'id':integer(),'actor_id':integer(),'action':text(),'revision':integer(),'created_at':text()})
schemas['Account']=obj({'id':integer(),'registration':{'$ref':'registration.openapi.json#/components/schemas/Registration'},
    'capabilities':{'type':'object','additionalProperties':{'type':'boolean'}}})
schemas['Capabilities']=obj({key:boolean() for key in ('customer','performer','create_order','create_service','django_admin','moderate_services','moderate_performers')})
schemas['Account']['properties']['capabilities']=ref('Capabilities')
schemas['Cabinet']={'type':'object','description':'Точный состав см. API_CONTRACT Cabinet: role/account_id/registration/capabilities/orders/services/moderation/statistics/unavailable.',
    'properties':{'role':{'enum':['customer','performer']},'account_id':integer(),'registration':{'$ref':'registration.openapi.json#/components/schemas/Registration'},
        'capabilities':{'type':'object'},'orders':{'type':'object'},'services':{'type':'object','nullable':True},'moderation':{'allOf':[ref('Moderation')],'nullable':True},
        'statistics':{'type':'object'},'unavailable':array(text())},'required':['role','account_id','registration','capabilities','orders','services','moderation','statistics','unavailable'],'additionalProperties':False}
schemas['Cabinet']['properties']['capabilities']=ref('Capabilities')
schemas['Cabinet']['properties']['orders']=obj({'count':integer(),'by_status':obj({key:integer() for key in ('pending_acceptance','awaiting_payment','cancelled','declined')}),'url':text()})
schemas['Cabinet']['properties']['services']={'type':'object','nullable':True,'properties':{key:integer() for key in ('pending','published','rejected','draft','changes')},'additionalProperties':False}
schemas['Cabinet']['properties']['statistics']=obj({'completed_orders':{'type':'integer','nullable':True},'rating':{'type':'number','nullable':True},'review_count':{'type':'integer','nullable':True}})

for name, item, cursor in [('Services',ref('Service'),False),('Services2',ref('Service2'),False),('OwnServices2',ref('OwnService2'),False),
    ('Examples',ref('Example'),False),('Orders2',ref('Order2'),False),('Conversations',ref('Conversation'),False),('Messages',ref('Message'),True),('Events',ref('Event'),False)]:
    schemas[name]=page(array(item),cursor)

paths={}
def add(path, method, summary, response, request=None, success=200, public=False, multipart=False, params=()):
    params=list(params)
    for part in path.split('/'):
        if part.startswith('{'):
            name=part[1:-1]
            params.append({'name':name,'in':'path','required':True,'schema':{'type':'string','format':'uuid'} if name in ('uuid','quote_id','conversation_id') else {'type':'integer','format':'int64','minimum':1}})
    operation={'summary':summary,'security':[] if public else [{'sessionCookie':[],**({'csrfToken':[]} if method!='get' else {})}],
        'responses':{str(success):{'description':'Успех','content':{'application/json':{'schema':ref(response)}}} if success!=204 else {'description':'Успех без тела'},
            **{str(code):{'description':label,'content':{'application/json':{'schema':ref('Error')}}} for code,label in [(400,'Ошибка полей'),(403,'Сессия CSRF роль или permission'),(404,'Отсутствующий или чужой объект'),(409,'Редакция или намерение изменились'),(503,'Недоступность тарифа/зависимости')]}}}
    if success==201: operation['responses']['200']={'description':'Повтор сохранённого намерения','content':{'application/json':{'schema':ref(response)}}}
    if params: operation['parameters']=params
    if request: operation['requestBody']={'required':True,'content':{'application/json':{'schema':ref(request)}}}
    if multipart: operation['requestBody']['content']['multipart/form-data']={'schema':ref('ExampleMultipart')}
    paths.setdefault(path,{})[method]=operation

add('/api/v1/account/','get','Канонический аккаунт и capabilities','Account')
add('/api/v1/cabinet/','get','Кабинет роли','Cabinet',params=[{'name':'role','in':'query','required':True,'schema':{'type':'string','enum':['customer','performer']}}])
add('/api/v1/favorites/','get','Свои видимые избранные услуги','Services')
for method in ('put','delete'): add('/api/v1/favorites/{id}/',method,'Идемпотентное избранное','Empty','Empty',204)
add('/api/v1/portfolio/','get','Свои примеры работ','Examples')
add('/api/v1/portfolio/','post','Добавить ссылку или файл','ExampleMutation','ExampleJson',201,multipart=True)
add('/api/v1/portfolio/{uuid}/','patch','Правка названия или ссылки','ExampleMutation','ExampleEditInput')
add('/api/v1/portfolio/{uuid}/','delete','Логическое удаление работы','ExampleDelete','Version')
add('/api/v1/portfolio/{uuid}/content/','get','Приватный файл owner или модератору','Empty')
paths['/api/v1/portfolio/{uuid}/content/']['get']['responses']['200']={'description':'Закрытый файл attachment/no-store/nosniff','content':{'application/octet-stream':{'schema':{'type':'string','format':'binary'}}}}
add('/api/v1/performer/moderation/','get','Состояние отдельной модерации профиля','Moderation')
add('/api/v1/performer/moderation/','post','Подать профиль на модерацию','Moderation','Version')
add('/api/v1/staff/performers/{user_id}/decision/','post','Решение профильного модератора','Moderation','Decision')
for path,response in [('/api/v2/services/','Services2'),('/api/v2/services/{id}/','Service2')]: add(path,'get','Публичная услуга STUDLY 2',response,public=True)
add('/api/v2/my/services/','get','Свои услуги','OwnServices2')
add('/api/v2/my/services/','post','Новый черновик revision=0','OwnService2','Draft',201)
add('/api/v2/my/services/{id}/','get','Собственная редакция','OwnService2')
add('/api/v2/my/services/{id}/','patch','Правка собственной редакции','OwnService2','Draft')
add('/api/v2/my/services/{id}/submit/','post','Подать полную редакцию','OwnService2','Version')
add('/api/v1/staff/services/{id}/decision/','post','Решение модератора услуги','OwnService2','Decision')
add('/api/v2/quotes/','post','Сохранённый серверный расчёт 5%','Quote','QuoteInput',201)
paths['/api/v2/quotes/']['post']['responses'].pop('200',None)
add('/api/v2/quotes/{quote_id}/','get','Свой сохранённый расчёт','Quote')
add('/api/v2/orders/','get','Собственные заказы двух ролей','Orders2')
add('/api/v2/orders/','post','Заказ по подтверждённому quote','Order2','PurchaseInput',201)
add('/api/v2/orders/{id}/','get','Заказ участника','Order2')
for action in ('accept','cancel','decline'): add('/api/v2/orders/{id}/'+action+'/','post','Неоплаченная операция '+action,'Order2','Version')
add('/api/v1/orders/{id}/events/','get','Подтверждённая история заказа','Events')
add('/api/v1/orders/{id}/conversation/','get','Устойчивый контекст заказа','Conversation')
add('/api/v1/conversations/','get','Только свои контексты','Conversations')
add('/api/v1/discussions/','post','Отдельное обсуждение услуги до заказа','Conversation','DiscussionInput',201)
add('/api/v1/conversations/{conversation_id}/','get','Контекст участника','Conversation')
add('/api/v1/conversations/{conversation_id}/messages/','get','Свои видимые сообщения cursor','Messages',params=[{'name':'cursor','in':'query','schema':{'type':'string'}}])
add('/api/v1/conversations/{conversation_id}/messages/','post','Сохранить сообщение после проверки правил','Message','MessageInput',201)
add('/api/v1/security-cases/{id}/appeal/','get','Своя причина удержания','Case')
add('/api/v1/security-cases/{id}/appeal/','post','Обжаловать удержание','Case','AppealInput')
add('/api/v1/staff/security-cases/{id}/','get','Чтение конкретного случая с аудитом','CaseDetail',params=[{'name':'purpose','in':'query','required':True,'schema':{'type':'string','minLength':1,'maxLength':500}}])
add('/api/v1/staff/security-cases/{id}/','post','Ручное release или keep','Case','SecurityDecision')
schemas['StaffSession']=obj({'id':integer(),'display_name':text(),'resources':array(text()),'unavailable':array(text())})
schemas['StaffProjection']={'type':'object','description':'Ресурсная проекция по allowlist API_CONTRACT; не включает пароли/Telegram ID/общую переписку.'}
schemas['StaffPage']=page(array(ref('StaffProjection')))
add('/api/v1/staff/me/','get','Служебные capabilities из permissions','StaffSession')
for resource in ('users','performers','services','orders','events','security-cases'):
    add('/api/v1/staff/'+resource+'/','get','Разрешённый служебный список '+resource,'StaffPage')
    if resource!='security-cases': add('/api/v1/staff/'+resource+'/{id}/','get','Разрешённый служебный объект '+resource,'StaffProjection')

schemas['StaffUser']=obj({'id':integer(),'display_name':text(),'is_active':boolean(),'roles':array({'type':'string','enum':['customer','performer']})})
schemas['StaffPerformer']=json.loads(json.dumps(schemas['Moderation']))
schemas['StaffPerformer']['properties'].update(display_name=text(),description=text(),examples=array(ref('Example')))
schemas['StaffPerformer']['required'] += ['display_name','description','examples']
schemas['AuditEvent']=obj({'id':integer(),'actor_id':integer(),'operation':text(),'target':text(),'details':{'type':'object'},'created_at':text()})
for resource, name in {'users':'StaffUser','performers':'StaffPerformer','services':'OwnService2','orders':'Order','events':'AuditEvent','security-cases':'Case'}.items():
    schemas['StaffPage'+resource]=page(array(ref(name)))
    paths['/api/v1/staff/'+resource+'/']['get']['responses']['200']['content']['application/json']['schema']=ref('StaffPage'+resource)
    if resource!='security-cases':
        paths['/api/v1/staff/'+resource+'/{id}/']['get']['responses']['200']['content']['application/json']['schema']=ref(name)

for path, methods in paths.items():
    if 'get' not in methods: continue
    operation = methods['get']
    response_name = operation['responses']['200'].get('content',{}).get('application/json',{}).get('schema',{}).get('$ref','').split('/')[-1]
    if response_name in ('Services','Services2','OwnServices2','Examples','Orders2','Conversations','Events') or response_name.startswith('StaffPage'):
        operation.setdefault('parameters',[]).append({'name':'page','in':'query','schema':{'type':'integer','minimum':1}})
    if path == '/api/v2/services/':
        operation.setdefault('parameters',[]).extend({'name':name,'in':'query','schema':{'type':'string'}} for name in ('search','performer','ids','category','min_price','max_price','min_duration','max_duration'))
        operation.setdefault('parameters',[]).append({'name':'ordering','in':'query','schema':{'type':'string','enum':['id','newest','price_asc','price_desc','duration_asc']}})
    if path == '/api/v2/orders/':
        operation.setdefault('parameters',[]).append({'name':'role','in':'query','schema':{'type':'string','enum':['customer','performer']}})
    if path.startswith('/api/v1/staff/') and response_name.startswith('StaffPage'):
        resource=path.split('/')[-2]
        if resource in ('users','performers','services','orders','events'):
            operation.setdefault('parameters',[]).append({'name':'search','in':'query','schema':{'type':'string','maxLength':200}})
        if resource in ('performers','services','orders'):
            operation.setdefault('parameters',[]).append({'name':'status','in':'query','schema':{'type':'string'}})

document={'openapi':'3.0.3','info':{'title':'STUDLY Backend workspace API','version':'2.0.0-local-20261024',
    'description':'Новые локальные исходники поверх d7a5ffa; не deployment и не INTEGRATED. Авторитетные пояснения и permissions в API_CONTRACT.md. Старые auth/registration см. registration.openapi.json.'},
    'servers':[{'url':'http://127.0.0.1:8000','description':'Изолированное окружение после разрешённых локальных миграций'}],
    'paths':paths,'components':{'securitySchemes':{'sessionCookie':{'type':'apiKey','in':'cookie','name':'sessionid'},'csrfToken':{'type':'apiKey','in':'header','name':'X-CSRFToken'}},'schemas':schemas}}
(root/'docs/workspace.openapi.json').write_text(json.dumps(document,ensure_ascii=False,indent=2)+'\n')
print(len(paths),'paths;',len(schemas),'schemas')
