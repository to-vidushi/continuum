import Sidebar from '@/components/Sidebar'
import styles from './AppLayout.module.css'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.root}>
      <Sidebar />
      <main className={styles.main}>
        {children}
      </main>
    </div>
  )
}