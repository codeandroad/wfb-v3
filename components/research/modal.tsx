"use client"
import { useEffect,useId,useRef,useState,type ReactNode } from "react"
import { createPortal } from "react-dom"
import styles from "./workspace.module.css"
let modalLocks=0,overflowBeforeLock=""
/** Native dialog styled like the approved HTML; portals stay separate from the homework modal. */
export function Modal({ open,onClose,title,desc,children,footer,width,draft = false,custom = false,fullscreen = false,printable = false }: { open: boolean;onClose: () => void;title: ReactNode;desc?: ReactNode;children?: ReactNode;footer?: ReactNode;width?: string;draft?: boolean;custom?: boolean;fullscreen?: boolean;printable?: boolean }) {
 const ref = useRef<HTMLDialogElement>(null),[mounted,setMounted] = useState(false),titleId = useId()
 useEffect(() => setMounted(true),[])
 useEffect(() => { if (!mounted || !open) return; const dialog = ref.current; if (!dialog) return; const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null; if (!dialog.open) { dialog.showModal(); dialog.querySelector<HTMLElement>('input:not([type="checkbox"]):not([type="file"]):not([disabled]), textarea:not([disabled]), select:not([disabled])')?.focus() }; if(modalLocks===0)overflowBeforeLock=document.body.style.overflow;modalLocks++;document.body.style.overflow = "hidden"; return () => { if (dialog.open) dialog.close(); modalLocks=Math.max(0,modalLocks-1);if(modalLocks===0)document.body.style.overflow=overflowBeforeLock; queueMicrotask(() => { const dialogs=[...document.querySelectorAll('dialog[open], [role="dialog"][aria-modal="true"]')]; if (trigger?.isConnected && (!dialogs.length || trigger.closest('dialog[open], [role="dialog"][aria-modal="true"]') === dialogs.at(-1))) trigger.focus({ preventScroll: true }) }) } },[mounted,open])
 if (!mounted || !open) return null
 return createPortal(<dialog ref={ref} aria-labelledby={titleId} className={`${styles.scope} ${styles.modal} ${fullscreen?styles.fullscreen:""} ${printable?styles.printable:""} ry-dialog`} data-research-dialog data-research-print={printable||undefined} data-width={width} onCancel={e => { e.preventDefault(); onClose() }} onKeyDown={e => {
  if (e.key !== "Tab") return
  const targets = [...e.currentTarget.querySelectorAll<HTMLElement>('a[href],button,input,select,textarea,[tabindex]')].filter(el => el.tabIndex >= 0 && !el.matches('[disabled],[aria-disabled="true"]') && el.getClientRects().length && getComputedStyle(el).visibility !== "hidden")
  const first = targets[0],last = targets.at(-1)
  if (first && last && (e.shiftKey && document.activeElement === first || !e.shiftKey && document.activeElement === last)) { e.preventDefault(); (e.shiftKey ? last : first).focus() }
 }} onClick={e => { if (e.target === e.currentTarget) { const rect=e.currentTarget.getBoundingClientRect(); if(e.clientX<rect.left || e.clientX>rect.right || e.clientY<rect.top || e.clientY>rect.bottom) onClose() } }}>{custom?<><h2 className="sr-only" id={titleId}>{title}</h2>{children}</>:<div className="ry-modal-frame"><header className="ry-modal-head"><div><h2 id={titleId}>{title}</h2>{desc && <p>{desc}</p>}</div><button type="button" className="ry-modal-close" aria-label="关闭" onClick={onClose}>×</button></header><div className="ry-form-body">{children}</div>{footer && <footer className="ry-modal-footer">{draft && <span className="ry-draft-state">输入自动保留为本机草稿</span>}{footer}</footer>}</div>}</dialog>,document.body)
}
