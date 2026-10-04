import { NextResponse } from 'next/server'
import { mkdir, writeFile } from 'node:fs/promises'
export async function POST(request:Request){
  if(process.env.NODE_ENV!=='development')return new NextResponse(null,{status:404})
  const url=new URL(request.url),name=url.searchParams.get('name')??''
  if(!/^[A-Za-z0-9_-]+\.(png|zip|json)$/.test(name))return new NextResponse(null,{status:400})
  const bytes=Buffer.from(await request.arrayBuffer())
  if(bytes.length>96*1024*1024)return new NextResponse(null,{status:413})
  await mkdir('/tmp/report-evidence',{recursive:true});await writeFile(`/tmp/report-evidence/${name}`,bytes)
  return NextResponse.json({name,bytes:bytes.length})
}
