import { PublicationRecords } from '@/components/mt/publication-records'
export const metadata = { title: '教师发布档案与汇总' }
export default async function Page({searchParams}:{searchParams:Promise<{teacher?:string}>}) {
  const params = await searchParams
  return <PublicationRecords initialTeacher={typeof params.teacher === 'string' ? params.teacher : ''}/>
}
