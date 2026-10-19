"use client"
import type { ButtonHTMLAttributes,ReactNode } from "react"
import katex from "katex"
import "katex/dist/katex.min.css"
import styles from "./replica.module.css"
export function SourceRoot({children,className=""}:{children:ReactNode;className?:string}) {return <div className={`${styles.replica} ${className}`}>{children}</div>}
export function SButton({className="",...props}:ButtonHTMLAttributes<HTMLButtonElement>){return <button type="button" className={`btn ${className}`} {...props}/>}
export function SourceRich({text}:{text:string}){return <div className="exact-rich">{text.split(/(\$\$[\s\S]*?\$\$|\$(?!\$)(?:\\.|[^$\n])+\$)/g).map((part,i)=>{const block=part.startsWith('$$')&&part.endsWith('$$'),inline=!block&&part.startsWith('$')&&part.endsWith('$');return block||inline?<span key={i} className={block?'kf-block':''} role="math" aria-label={part.slice(block?2:1,block?-2:-1)} dangerouslySetInnerHTML={{__html:katex.renderToString(part.slice(block?2:1,block?-2:-1),{displayMode:block,trust:false,throwOnError:false,strict:'warn',output:'htmlAndMathml'})}}/>:<span key={i}>{part}</span>})}</div>}
export function downloadJSON(name:string,value:unknown){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
