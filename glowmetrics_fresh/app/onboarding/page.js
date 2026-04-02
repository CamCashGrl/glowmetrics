"use client"
import { useRouter } from "next/navigation"
import { useState } from "react"

export default function Onboarding(){

  const router = useRouter()
  const [fileName,setFileName] = useState("")

  const handleUpload = (e)=>{
    const file = e.target.files[0]
    if(file){
      setFileName(file.name)

      // simulate processing delay before redirect
      setTimeout(()=>{
        router.push("/onboarding/loading")
      },800)
    }
  }

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

      <h1 style={{color:"white",fontSize:32,fontWeight:800}}>
        Upload Your Earnings Data
      </h1>

      <p style={{marginTop:10,color:"#64748b"}}>
        Upload your CSV to unlock your insights
      </p>

      <label style={{
        marginTop:30,
        padding:"16px 40px",
        borderRadius:12,
        background:"linear-gradient(135deg,#3b82f6,#ec4899)",
        color:"white",
        cursor:"pointer",
        fontWeight:700
      }}>
        Upload CSV
        <input type="file" hidden onChange={handleUpload}/>
      </label>

      {fileName && (
        <p style={{marginTop:15,fontSize:13,color:"#ec4899"}}>
          {fileName} uploaded
        </p>
      )}

    </div>
  )
}
