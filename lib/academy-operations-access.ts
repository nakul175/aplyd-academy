export function canShowWorkspaceOperations(team: any): boolean {
  return (
    !!team &&
    team.active === true &&
    Array.isArray(team.roles) &&
    team.roles.some((r: unknown) => r === 'admin' || r === 'facilitator')
  );
}
