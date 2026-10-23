import json
import re
from pathlib import Path

from django.test import SimpleTestCase
from django.urls import resolve

from accounts.portfolio_views import VersionedAction, ExampleInput, ExampleEditInput, DecisionInput
from catalog.workspace import DraftInput, ExtraInput
from conversations.views import MessageInput, AppealInput, SecurityDecisionInput, DiscussionInput
from orders.workspace import QuoteInput, PurchaseInput


class WorkspaceContractTests(SimpleTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.document = json.loads((Path(__file__).resolve().parents[3]/'docs/workspace.openapi.json').read_text())

    def test_documented_paths_resolve_to_existing_methods_and_private_sessions(self):
        for path, operations in self.document['paths'].items():
            concrete = re.sub(r'\{(?:uuid|quote_id|conversation_id)\}', '00000000-0000-4000-8000-000000000001', path)
            concrete = re.sub(r'\{[^}]+\}', '1', concrete)
            view = resolve(concrete).func.cls
            for method, operation in operations.items():
                with self.subTest(path=path, method=method):
                    self.assertTrue(callable(getattr(view, method, None)))
                    if not path.startswith('/api/v2/services/'):
                        self.assertTrue(operation['security'])
                    if method != 'get':
                        self.assertIn('csrfToken', operation['security'][0])

    def test_input_field_contract_matches_live_serializers(self):
        pairs={'Version':VersionedAction,'ExampleInput':ExampleInput,'ExampleEditInput':ExampleEditInput,
               'Decision':DecisionInput,'Draft':DraftInput,'Extra':ExtraInput,'QuoteInput':QuoteInput,
               'PurchaseInput':PurchaseInput,'MessageInput':MessageInput,'AppealInput':AppealInput,
               'SecurityDecision':SecurityDecisionInput,'DiscussionInput':DiscussionInput}
        for name, serializer in pairs.items():
            with self.subTest(schema=name):
                self.assertEqual(set(self.document['components']['schemas'][name]['properties']), set(serializer().fields))
