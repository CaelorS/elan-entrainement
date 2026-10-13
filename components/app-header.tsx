import type {ReactNode} from 'react';

export function AppHeader({tagline='L’ENTRAÎNEMENT, SIMPLEMENT.',onHome,children}:{tagline?:string;onHome?:()=>void;children?:ReactNode}){
 const logo=<>é<span>l</span>an<span className="brand-dot">.</span></>;
 return <header className="topbar">{onHome?<button className="brand" onClick={onHome} aria-label="Accueil Élan">{logo}</button>:<span className="brand">{logo}</span>}<span className="top-label">{tagline}</span>{children}</header>;
}
