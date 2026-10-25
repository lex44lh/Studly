# Изменения исходников и тестов нового функционального этапа

Сравнение с сохранённым снимком src/tests перед реализацией 22.10.2026 20:51 MSK. Прежний визуальный Redesign не пересоздавался. Полный Git delta относительно HEAD, включая прежнюю работу и скриншоты, перечисляется в итоговом manifest.

| Файл | Действие |
|---|---|
| `apps/web/src/app/admin/page.tsx` | new |
| `apps/web/src/app/category/[slug]/page.tsx` | modified |
| `apps/web/src/app/chats/[id]/page.tsx` | modified |
| `apps/web/src/app/chats/page.tsx` | modified |
| `apps/web/src/app/create-service/page.tsx` | modified |
| `apps/web/src/app/favorites/page.tsx` | modified |
| `apps/web/src/app/orders/[id]/page.tsx` | modified |
| `apps/web/src/app/orders/page.tsx` | modified |
| `apps/web/src/app/page.tsx` | modified |
| `apps/web/src/app/profile/[id]/page.tsx` | modified |
| `apps/web/src/app/profile/page.tsx` | modified |
| `apps/web/src/app/register/layout.tsx` | modified |
| `apps/web/src/app/service/[id]/page.tsx` | modified |
| `apps/web/src/app/welcome/page.tsx` | modified |
| `apps/web/src/components/AppShell.tsx` | modified |
| `apps/web/src/components/catalog/LiveSearch.tsx` | modified |
| `apps/web/src/components/registration/PerformerForm.tsx` | modified |
| `apps/web/src/components/registration/ProfileForm.tsx` | modified |
| `apps/web/src/components/registration/RegistrationShell.tsx` | modified |
| `apps/web/src/components/registration/SpecializationPicker.tsx` | modified |
| `apps/web/src/components/studly/CampusShell.tsx` | modified |
| `apps/web/src/context/FavoritesContext.tsx` | modified |
| `apps/web/src/context/RegistrationContext.tsx` | modified |
| `apps/web/src/features/demo-workspace/AccountWorkspace.tsx` | new |
| `apps/web/src/features/demo-workspace/AdminWorkspace.tsx` | new |
| `apps/web/src/features/demo-workspace/CommerceWorkspace.tsx` | new |
| `apps/web/src/features/demo-workspace/LegacyHistory.tsx` | new |
| `apps/web/src/features/demo-workspace/Provider.tsx` | new |
| `apps/web/src/features/demo-workspace/PublicPerformer.tsx` | new |
| `apps/web/src/features/demo-workspace/RegistrationAdapter.tsx` | new |
| `apps/web/src/features/demo-workspace/Routing.tsx` | new |
| `apps/web/src/features/demo-workspace/ServiceWorkspace.tsx` | new |
| `apps/web/src/features/demo-workspace/WelcomeAction.tsx` | new |
| `apps/web/src/features/demo-workspace/account.module.css` | new |
| `apps/web/src/features/demo-workspace/admin.module.css` | new |
| `apps/web/src/features/demo-workspace/catalog.ts` | new |
| `apps/web/src/features/demo-workspace/commerce.module.css` | new |
| `apps/web/src/features/demo-workspace/domain.ts` | new |
| `apps/web/src/features/demo-workspace/model.ts` | new |
| `apps/web/src/features/demo-workspace/repository.ts` | new |
| `apps/web/src/features/demo-workspace/ui.tsx` | new |
| `apps/web/src/features/demo-workspace/workspace.css` | new |
| `apps/web/tests/demo-account-rendering.test.cjs` | new |
| `apps/web/tests/demo-admin-rendering.test.cjs` | new |
| `apps/web/tests/demo-catalog-adapter.test.cjs` | new |
| `apps/web/tests/demo-commerce-rendering.test.cjs` | new |
| `apps/web/tests/demo-order-rendering.test.cjs` | modified |
| `apps/web/tests/demo-registration-adapter.test.cjs` | new |
| `apps/web/tests/demo-repository.test.cjs` | new |
| `apps/web/tests/demo-route-isolation.test.cjs` | new |
| `apps/web/tests/demo-workspace-domain.test.cjs` | new |
