import GroupCrudPage from '../../components/GroupCrudPage';
import {
  providerGroupsCreate,
  providerGroupsDelete,
  providerGroupsList,
  providerGroupsUpdate,
} from '../../lib/api';

export default function ProviderGroupsPage() {
  return (
    <GroupCrudPage
      title="Provider Groups"
      entityName="provider group"
      listFn={providerGroupsList}
      createFn={providerGroupsCreate}
      updateFn={providerGroupsUpdate}
      deleteFn={providerGroupsDelete}
    />
  );
}
