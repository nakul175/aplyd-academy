/**
 * Sidebar and mount gating for the Account recovery, Data requests and Audit log views.
 * Display gating only: every server action behind these views still enforces its own role
 * check. Mirrors canShowWorkspaceOperations (active membership, roles from the projected team).
 */
const roles = (team: any): unknown[] =>
  team && team.active === true && Array.isArray(team.roles) ? team.roles : [];
/** Account recovery and Audit log: active workspace admin only. */
export const canShowAdminViews = (team: any): boolean => roles(team).includes('admin');
/** Data requests: any active workspace member (at least one role). */
export const canShowDataRequests = (team: any): boolean => roles(team).length > 0;
export type ExtraViewKey = 'recovery' | 'requests' | 'audit';
export function canShowExtraView(view: string, team: any): boolean {
  return view === 'requests'
    ? canShowDataRequests(team)
    : view === 'recovery' || view === 'audit'
      ? canShowAdminViews(team)
      : false;
}
