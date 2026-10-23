from django.db.models import Exists, OuterRef, Q
from .models import Service


def public_services():
    links = Service.portfolio_examples.through.objects.filter(service_id=OuterRef("pk"))
    invalid_links = links.filter(Q(portfolioexample__active=False) | ~Q(portfolioexample__profile__user_id=OuterRef("performer_id")))
    return Service.objects.annotate(invalid_portfolio=Exists(invalid_links)).filter(status="published").filter(
        Q(is_demo=True) | Q(performer__is_active=True, performer__is_performer=True,
                           performer__performer_profile__moderation_status="approved", invalid_portfolio=False)
    )
