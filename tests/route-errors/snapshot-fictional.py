"""Optional read-only hash/count of existing fictional loopback rows only."""
import hashlib, json, pathlib, sqlite3, sys
path = pathlib.Path(sys.argv[1]).resolve()
connection = sqlite3.connect(path.as_uri() + '?mode=ro', uri=True)
tables = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")}
result = {}
queries = {
    'academy_workspaces': "SELECT * FROM academy_workspaces WHERE owner LIKE 'qa-%' ORDER BY owner",
    'academy_audit': "SELECT * FROM academy_audit WHERE owner LIKE 'qa-%' ORDER BY owner,revision,event_id",
    'academy_teams': "SELECT * FROM academy_teams WHERE created_by LIKE 'qa-%' ORDER BY id",
    'academy_team_audit': "SELECT a.* FROM academy_team_audit a JOIN academy_teams t ON t.id=a.team_id WHERE t.created_by LIKE 'qa-%' ORDER BY a.team_id,a.revision,a.event_id",
    'academy_invite_tokens': "SELECT a.* FROM academy_invite_tokens a JOIN academy_teams t ON t.id=a.team_id WHERE t.created_by LIKE 'qa-%' ORDER BY a.team_id,a.invite_id",
    'academy_team_history': "SELECT a.* FROM academy_team_history a JOIN academy_teams t ON t.id=a.team_id WHERE t.created_by LIKE 'qa-%' ORDER BY a.team_id,a.revision",
    'academy_team_directory': "SELECT a.* FROM academy_team_directory a JOIN academy_teams t ON t.id=a.team_id WHERE t.created_by LIKE 'qa-%' ORDER BY a.team_id,a.user_id",
}
for table, query in queries.items():
    if table not in tables:
        continue
    rows = connection.execute(query).fetchall()
    canonical = json.dumps(rows, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    result[table] = {'rows':len(rows), 'sha256':hashlib.sha256(canonical).hexdigest()}
connection.close()
print(json.dumps(result, separators=(',', ':')))
