const test=require('node:test');
const assert=require('node:assert/strict');
const {DesignSession,MODES}=require('../../temp/redesign-model.cjs');
for(const mode of MODES)test(`${mode.title}: original-engine certificate completes displayed objective`,()=>{
  const s=new DesignSession(mode.id);
  for(const action of s.initialSolution){if(s.won)break;assert.equal(s.apply(action),true);}
  assert.equal(s.won,true);assert.equal(s.lost,false);assert.ok(s.moves<=s.budget);assert.equal(s.progress,1);
});
test('Undo restores board, objective accounting, energy, and certificate together',()=>{
  const s=new DesignSession('garden');
  const before=JSON.stringify({grid:s.grid,solution:s.solution,collected:s.collected});
  s.apply(s.solution[0]);assert.equal(s.moves,1);assert.equal(s.undo(),true);
  assert.equal(JSON.stringify({grid:s.grid,solution:s.solution,collected:s.collected}),before);
  assert.equal(s.charge,0);assert.equal(s.blooms.size,0);assert.equal(s.moves,0);
});
test('Flower objectives are spread across the board rather than all completing on the opening cascade',()=>{
  const s=new DesignSession('garden');assert.equal(s.flowerCells.size,4);
  s.apply(s.solution[0]);assert.equal(s.won,false);assert.ok(s.blooms.size<4);
});
test('Order objective never prevents non-target identical tiles from pairing',()=>{
  const s=new DesignSession('orders');s.grid=[[['3p'],['3p']],[['2s'],['2s']]];s.orderFaces=['2s','1m'];s.solution=[];
  assert.equal(s.apply({kind:'match',a:{r:0,c:0},b:{r:0,c:1}}),true);assert.equal(s.collected['3p'],2);assert.equal(s.won,false);
});
test('Breaking ice gives no collection, floor bloom, or energy credit',()=>{
  const s=new DesignSession('garden');s.grid=[[['1p~'],['1p~']],[['2p'],['2p']]];s.flowerCells=new Set(['0,0']);s.solution=[];
  assert.equal(s.apply({kind:'match',a:{r:0,c:0},b:{r:0,c:1}}),true);assert.equal(s.charge,0);assert.equal(s.blooms.size,0);assert.equal(s.collected['1p'],undefined);
  assert.equal(s.apply({kind:'match',a:{r:0,c:0},b:{r:0,c:1}}),true);assert.equal(s.charge,1);assert.equal(s.blooms.size,1);assert.equal(s.won,true);
});
test('Energy cannot be used before full and is consumed only when a hint is found',()=>{
  const s=new DesignSession('energy');assert.equal(s.useEnergy(),false);
  while(s.charge<4&&!s.won)s.apply(s.solution[0]);assert.equal(s.charge,4);assert.equal(s.useEnergy(),true);assert.equal(s.charge,0);assert.ok(s.hint);
});
test('No post-finish move or duplicate reward mutation is possible',()=>{
  const s=new DesignSession();for(const a of s.initialSolution){if(!s.won)s.apply(a);}
  const moves=s.moves;assert.equal(s.apply(s.initialSolution[0]),false);assert.equal(s.moves,moves);
});
