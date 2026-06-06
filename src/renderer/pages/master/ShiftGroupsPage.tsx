import { useNavigate } from 'react-router-dom';
import GroupCrudPage from '../../components/GroupCrudPage';
import {
  shiftGroupsCreate,
  shiftGroupsDelete,
  shiftGroupsList,
  shiftGroupsUpdate,
} from '../../lib/api';

export default function ShiftGroupsPage() {
  const navigate = useNavigate();

  return (
    <GroupCrudPage
      title="Shift Groups"
      entityName="shift group"
      listFn={shiftGroupsList}
      createFn={shiftGroupsCreate}
      updateFn={shiftGroupsUpdate}
      deleteFn={shiftGroupsDelete}
      renderExtraActions={(row) => (
        <button
          type="button"
          className="text-indigo-600 hover:underline"
          onClick={() => navigate(`/master/shifts?groupId=${row.id}`)}
        >
          View Shifts
        </button>
      )}
    />
  );
}
