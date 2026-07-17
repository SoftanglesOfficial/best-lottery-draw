import { useNavigate } from 'react-router-dom';
import GroupCrudPage from '../../components/GroupCrudPage';
import { api } from '../../lib/api';

export default function ShiftGroupsPage() {
  const navigate = useNavigate();

  return (
    <GroupCrudPage
      title="Shift Groups"
      entityName="shift group"
      listFn={api.shiftGroupsList}
      createFn={api.shiftGroupsCreate}
      updateFn={api.shiftGroupsUpdate}
      deleteFn={api.shiftGroupsDelete}
      renderExtraActions={(row) => (
        <button
          type="button"
          className="rounded-cyber px-1.5 py-1 text-cyber-hover outline-none hover:bg-cyber/10 focus-visible:ring-2 focus-visible:ring-cyber/40"
          onClick={() => navigate(`/master/shifts?groupId=${row.id}`)}
        >
          View Shifts
        </button>
      )}
    />
  );
}
