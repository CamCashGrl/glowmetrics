"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

export default function Loading(){

  const router = useRouter()

  const steps = [
    "Analyzing your earnings...",
    "Finding your top spenders...",
    "Identifying best hours...",
    "Detecting inactive whales...",
    "Generating insights..."
  ]

  const [stepIndex,setStepIndex] = useState(0)

  useEffect(()=>{
    const interval = setInterval(()=>{
      setStepIndex((prev)=>{
        if(prev < steps.length - 1){
          return prev + 1
        } else {
          clearInterval(interval)
          setTimeout(()=>router.push("/dashboard"),800)
          return prev
        }
      })
    },1200)

    return ()=>clearInterval(interval)
  },[])

  return(
    <div style={{
      minHeight:"100vh",
      background:"#05070f",
      color:"#cbd5e1",
      display:"flex",
      alignItems:"center",
      justifyContent:"center",
      flexDirection:"column",
      fontFamily:"Inter"
    }}>

      <div style={{
        width:50,
        height:50,
        border:"4px solid rgba(255,255,255,0.1)",
        borderTop:"4px solid #ec4899",
        borderRadius:"50%",
        animation:"spin 1s linear infinite"
      }}/>

      <p style={{marginTop:20}}>
        {steps[stepIndex]}
      </p>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

    </div>
  )
}
