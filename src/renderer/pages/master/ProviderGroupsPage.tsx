import GroupCrudPage from '../../components/GroupCrudPage';
import { api } from '../../lib/api';

export default function ProviderGroupsPage() {
  return (
    <GroupCrudPage
      title="Provider Groups"
      entityName="provider group"
      listFn={api.providerGroupsList}
      createFn={api.providerGroupsCreate}
      updateFn={api.providerGroupsUpdate}
      deleteFn={api.providerGroupsDelete}
    />
  );
}
