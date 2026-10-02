import { TeacherHomepage } from "@/components/profile/teacher-homepage"

export const metadata = { title: "教师主页" }

export default async function TeacherHomepagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <TeacherHomepage ownerId={id} />
}
