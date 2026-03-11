<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>CSV Drag Import</title>

<style>
body{
font-family:Arial;
background:#111;
color:white;
text-align:center;
padding:40px;
}

#dropZone{
border:3px dashed #888;
padding:60px;
width:420px;
margin:auto;
border-radius:10px;
transition:.3s;
}

#dropZone.hover{
border-color:#00ffc3;
background:#1c1c1c;
}
</style>
</head>

<body>

<h2>Drag & Drop Platform CSV</h2>

<div id="dropZone">Drop CSV Here</div>

<script>

const dropZone = document.getElementById("dropZone")

dropZone.addEventListener("dragover", e=>{
e.preventDefault()
dropZone.classList.add("hover")
})

dropZone.addEventListener("dragleave", ()=>{
dropZone.classList.remove("hover")
})

dropZone.addEventListener("drop", e=>{
e.preventDefault()
dropZone.classList.remove("hover")

const file = e.dataTransfer.files[0]

if(!file.name.endsWith(".csv")){
alert("CSV only")
return
}

const reader = new FileReader()

reader.onload = event=>{
processCSV(event.target.result)
}

reader.readAsText(file)

})

function processCSV(text){

let rows = text.split("\n").map(r=>r.split(","))

let cleaned=[]

rows.forEach(r=>{

if(r.length < 3) return

let date = r[0]?.trim()
let user = r[1]?.trim()
let tokens = parseFloat(r[2])
let balance = r[3]

/* Fix Chaturbate format */
if(user?.includes("Tip From")){
tokens = parseFloat(r[2])
}

/* Fix BongaCams */
if(r[4]?.includes("$")){
tokens = parseFloat(r[3])
}

/* Skip header rows */
if(date === "Date" || date === "Date_Time") return

if(!isNaN(tokens)){
cleaned.push({
date:date,
user:user,
tokens:tokens
})
}

})

console.log("Clean rows:",cleaned)

alert("Processed "+cleaned.length+" valid rows")

}

</script>

</body>
</html>
