import {useLayoutEffect,useRef} from 'react';
import type {ReactNode} from 'react';

/** Fit the complete title on one line without truncating the side or movement. */
export function WorkoutHeading({title,label}:{title:string;label?:ReactNode}){
 const ref=useRef<HTMLHeadingElement>(null);
 useLayoutEffect(()=>{
  const heading=ref.current;if(!heading)return;
  let frame=0,lastWidth=-1,active=true;
  const fit=()=>{const text=heading.firstElementChild as HTMLElement;heading.style.fontSize='28px';const width=text.getBoundingClientRect().width;if(width>heading.clientWidth)heading.style.fontSize=(28*heading.clientWidth/width)+'px'};
  const schedule=()=>{if(!active)return;cancelAnimationFrame(frame);frame=requestAnimationFrame(fit)};
  fit();
  // A font change also resizes the heading's height. Only width changes need
  // another fit, outside the observer callback, to avoid a resize loop.
  const observer=new ResizeObserver(entries=>{const width=entries[0].contentRect.width;if(width!==lastWidth){lastWidth=width;schedule()}});observer.observe(heading);
  void document.fonts.ready.then(schedule);
  return()=>{active=false;cancelAnimationFrame(frame);observer.disconnect()};
 },[title]);
 return <div className="tunnel-heading"><h1 ref={ref} className="workout-title"><span>{title}</span></h1>{label&&<p className="eyebrow">{label}</p>}</div>;
}
