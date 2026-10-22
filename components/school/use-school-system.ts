"use client"
import { createElement,createContext,useContext,useEffect,useState,type ReactNode } from "react"
import { useDemo } from "@/lib/demo/store"
import { configureSchoolSystem,disconnectSchoolSystem,refreshSchoolSystem } from "@/lib/school/system-client"
const SchoolSystemContext=createContext({ready:true,error:""})
export function SchoolSystemProvider({children}:{children:ReactNode}) {
  const {persona,scenario}=useDemo()
  const enabled=scenario!=="parent" && (persona==="lin"||persona==="admin")
  const [state,setState]=useState({ready:process.env.NODE_ENV!=="development",error:""})
  useEffect(()=>{
    if(!enabled||process.env.NODE_ENV!=="development"){setState({ready:true,error:""});return}
    try {const saved=JSON.parse(window.sessionStorage.getItem("demo-identity-v2")??"null");if(saved&&(saved.persona!==persona||saved.scenario!==scenario))return}catch{}
    const controller=new AbortController()
    setState({ready:false,error:""})
    configureSchoolSystem(persona,controller.signal).then(()=>{if(!controller.signal.aborted)setState({ready:true,error:""})}).catch(error=>{if(!controller.signal.aborted)setState({ready:false,error:error.message})})
    return()=>{controller.abort();disconnectSchoolSystem()}
  },[enabled,persona,scenario])
  return createElement(SchoolSystemContext.Provider,{value:state},children)
}
export function useSchoolSystem(){return useContext(SchoolSystemContext)}
