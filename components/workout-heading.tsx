import {useLayoutEffect,useRef} from 'react';
import type {ReactNode} from 'react';

/** Fit the complete title on one line without truncating the side or movement. */
export function WorkoutHeading({title,label}:{title:string;label?:ReactNode}){
 const ref=useRef<HTMLHeadingElement>(null);
 useLayoutEffect(()=>{
  const heading=ref.current;if(!heading)return;
  const fit=()=>{const text=heading.firstElementChild as HTMLElement;heading.style.fontSize='28px';const width=text.getBoundingClientRect().width;if(width>heading.clientWidth)heading.style.fontSize=(28*heading.clientWidth/width)+'px'};
  fit();const observer=new ResizeObserver(fit);observer.observe(heading);
  void document.fonts.ready.then(fit);
  return()=>observer.disconnect();
 },[title]);
 return <div className="tunnel-heading"><h1 ref={ref} className="workout-title"><span>{title}</span></h1>{label&&<p className="eyebrow">{label}</p>}</div>;
}
