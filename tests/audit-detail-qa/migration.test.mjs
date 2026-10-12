import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {root,migrationFiles,applyMigrations} from './d1-shim.mjs';
const cols=(db,t)=>db.prepare(`PRAGMA table_info(${t})`).all().map(c=>c.name);

test('journal, snapshots and SQL files agree and the new migration is additive-only',()=>{
 const journal=JSON.parse(readFileSync(root+'/drizzle/meta/_journal.json','utf8')).entries,files=migrationFiles();
 assert.deepEqual(journal.map(e=>e.tag+'.sql'),files);journal.forEach((e,i)=>assert.equal(e.idx,i));
 // Pinned to 0006 (the audit-detail migration this suite was written for); later migrations have their own checks below.
 const last='0006_audit_detail.sql',sql=readFileSync(root+'/drizzle/'+last,'utf8');
 assert.ok(files.includes(last));assert.match(last,/^0006_/);assert.ok(/ADD `detail` text/.test(sql));assert.ok(!/DROP|NOT NULL|DELETE|UPDATE /i.test(sql),'additive and nullable only');
 JSON.parse(readFileSync(root+'/drizzle/meta/0006_snapshot.json','utf8'));
});

test('all drizzle/0*.sql apply in order and both audit tables gain a nullable detail column',()=>{
 const db=new DatabaseSync(':memory:');applyMigrations(db);
 for(const t of ['academy_audit','academy_team_audit']){assert.ok(cols(db,t).includes('detail'),t);const info=db.prepare(`PRAGMA table_info(${t})`).all().find(c=>c.name==='detail');assert.equal(info.notnull,0);assert.equal(info.type.toLowerCase(),'text')}
 assert.deepEqual(cols(db,'academy_audit').sort(),['owner','revision','event_id','action','request_hash','created_at','detail'].sort());
 assert.deepEqual(cols(db,'academy_team_audit').sort(),['team_id','revision','actor','event_id','action','request_hash','created_at','detail'].sort());
});

test('rows written before the migration survive and read back with a null detail',()=>{
 const db=new DatabaseSync(':memory:');applyMigrations(db,'0005_tearful_angel.sql');
 db.prepare('INSERT INTO academy_audit(owner,revision,event_id,action,request_hash,created_at) VALUES(?,?,?,?,?,?)').run('u1',1,'evt-1','enroll','h','2026-01-01T00:00:00Z');
 db.prepare('INSERT INTO academy_team_audit(team_id,revision,actor,event_id,action,request_hash,created_at) VALUES(?,?,?,?,?,?,?)').run('t1',1,'u1','evt-1','invite','h','2026-01-01T00:00:00Z');
 assert.ok(!cols(db,'academy_audit').includes('detail'));
 db.exec(readFileSync(root+'/drizzle/0006_audit_detail.sql','utf8').replaceAll('--> statement-breakpoint',''));
 assert.equal(db.prepare('SELECT detail FROM academy_audit').get().detail,null);assert.equal(db.prepare('SELECT detail,action FROM academy_team_audit').get().action,'invite');
 assert.throws(()=>db.prepare('INSERT INTO academy_audit(owner,revision,event_id,action,created_at) VALUES(?,?,?,?,?)').run('u1',1,'evt-dup','x','t'),/UNIQUE|constraint/i,'primary key still enforced');
});

test('0007 (ACA-US-1.2 refusal audit) only creates a new table and index; existing tables are untouched',()=>{
 const sql=readFileSync(root+'/drizzle/0007_access_refusals.sql','utf8');
 const statements=sql.split('--> statement-breakpoint').map(x=>x.trim()).filter(Boolean);
 assert.equal(statements.length,2);assert.match(statements[0],/^CREATE TABLE `academy_access_refusals`/);assert.match(statements[1],/^CREATE INDEX `idx_academy_access_refusals_created`/);
 assert.ok(!/DROP|DELETE|UPDATE |ALTER/i.test(sql),'no change to existing tables or rows');
 const db=new DatabaseSync(':memory:');applyMigrations(db);
 assert.deepEqual(cols(db,'academy_access_refusals').sort(),['id','actor_ref','route','method','status','created_at'].sort());
});
