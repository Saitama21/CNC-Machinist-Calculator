(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.EngineeringCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function identify(diameter,rawPitch,mode,data){
    const pitch=mode==='tpi'?25.4/rawPitch:rawPitch;
    return data.map(t=>{
      const diameterDelta=Math.abs(t.diameter-diameter);
      const pitchDelta=Math.abs(t.pitch-pitch);
      const score=Math.max(0,100-(diameterDelta/Math.max(.15,diameter*.015))*35-(pitchDelta/Math.max(.04,pitch*.07))*45);
      return {...t,diameterDelta,pitchDelta,score};
    }).filter(t=>t.score>5).sort((a,b)=>b.score-a.score).slice(0,5);
  }
  function tapDrill(diameter,pitch,engagement=75,type='cut'){
    const safeEngagement=Math.min(90,Math.max(50,engagement));
    const hole=type==='cut'?diameter-pitch*(safeEngagement/75):diameter-pitch*(safeEngagement/150);
    return {hole,nearestTenth:Math.round(hole*10)/10,engagement:safeEngagement};
  }
  function metricProfile(diameter,pitch){
    return {H:.8660254*pitch,d2:diameter-.649519*pitch,d3:diameter-1.226869*pitch,D1:diameter-1.082532*pitch,radialDepth:.613435*pitch};
  }
  function cone(D,d,L){const half=Math.atan((D-d)/(2*L))*180/Math.PI;return {half,full:half*2,ratio:2*L/(D-d),radialDifference:(D-d)/2}}
  function hex(acrossFlats){const acrossCorners=acrossFlats/Math.cos(Math.PI/6),side=acrossFlats/Math.sqrt(3);return {acrossCorners,side,area:Math.sqrt(3)*1.5*side*side}}
  function rotate(x,y,degrees){const r=degrees*Math.PI/180;return {x:x*Math.cos(r)-y*Math.sin(r),y:x*Math.sin(r)+y*Math.cos(r),radius:Math.hypot(x,y)}}
  const sizeSteps=[[0,3],[3,6],[6,10],[10,18],[18,30],[30,50],[50,80],[80,120],[120,180],[180,250],[250,315],[315,400],[400,500]];
  function iso286(nominal,field){
    if(!(nominal>0&&nominal<=500)) throw new RangeError('ISO 286 range is 0–500 mm');
    const match=String(field).trim().match(/^([A-Za-z]+)(\d{1,2})$/);if(!match)throw new TypeError('Invalid tolerance field');
    const letter=match[1],grade=Number(match[2]),step=sizeSteps.find(([lo,hi],i)=>nominal>lo&&nominal<=hi||(i===0&&nominal===lo));
    const D=Math.sqrt(Math.max(step[0],1)*step[1]),i=.45*Math.cbrt(D)+.001*D;
    const factors={5:7,6:10,7:16,8:25,9:40,10:64,11:100,12:160,13:250,14:400,15:640,16:1000,17:1600,18:2500};
    if(!factors[grade])throw new RangeError('Supported IT grades: 5–18');
    const tolerance=Math.round(i*factors[grade]);
    const base=letter.toLowerCase(),isHole=letter===letter.toUpperCase();let lower,upper;
    const deviation={g:2.5*Math.pow(D,.34),f:5.5*Math.pow(D,.41),e:11*Math.pow(D,.41),d:16*Math.pow(D,.44)};
    if(base==='js'){lower=-tolerance/2;upper=tolerance/2}
    else if(isHole&&base==='h'){lower=0;upper=tolerance}
    else if(!isHole&&base==='h'){upper=0;lower=-tolerance}
    else if(deviation[base]){
      const fundamental=Math.round(deviation[base]);
      if(isHole){lower=fundamental;upper=lower+tolerance}else{upper=-fundamental;lower=upper-tolerance}
    } else throw new RangeError('Supported fields: H, G, F, E, D, JS, h, g, f, e, d, js');
    return {nominal,field,grade,isHole,toleranceMicron:tolerance,lowerMicron:lower,upperMicron:upper,min:nominal+lower/1000,max:nominal+upper/1000,target:nominal+(lower+upper)/2000,step};
  }
  function turningRoughness(feed,noseRadius,targetRa=1.6){
    if(!(feed>0&&noseRadius>0))throw new RangeError('Feed and radius must be positive');
    const ra=1000*feed*feed/(32*noseRadius),rz=1000*feed*feed/(8*noseRadius),recommendedFeed=Math.sqrt(targetRa*32*noseRadius/1000);
    return {ra,rz,recommendedFeed,targetRa};
  }
  function truePosition({basicX,basicY,actualX,actualY,tolerance,featureType='hole',actualSize=0,mmcSize=0}){
    const dx=actualX-basicX,dy=actualY-basicY,position=2*Math.hypot(dx,dy);
    const bonus=featureType==='hole'?Math.max(0,actualSize-mmcSize):Math.max(0,mmcSize-actualSize),allowed=Math.max(0,tolerance)+bonus;
    return {dx,dy,position,bonus,allowed,pass:position<=allowed};
  }
  function boringBarDeflection({diameter,overhang,depth,feed,kc=2100,radialFactor=.3,elasticModulus=210000}){
    if(![diameter,overhang,depth,feed,kc,elasticModulus].every(v=>v>0))throw new RangeError('All values must be positive');
    const cuttingForce=kc*depth*feed,radialForce=cuttingForce*radialFactor,I=Math.PI*Math.pow(diameter,4)/64;
    const deflection=radialForce*Math.pow(overhang,3)/(3*elasticModulus*I),ratio=overhang/diameter;
    const level=ratio<=4&&deflection<=.01?'Хорошая жёсткость':ratio<=6&&deflection<=.03?'Допустимо':'Высокий риск вибрации';
    return {cuttingForce,radialForce,deflection,ratio,level};
  }
  return {identify,tapDrill,metricProfile,cone,hex,rotate,iso286,turningRoughness,truePosition,boringBarDeflection};
});
