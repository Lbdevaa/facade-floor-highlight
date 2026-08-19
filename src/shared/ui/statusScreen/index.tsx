import styles from './styles.module.css'

interface Props {
  kind: 'loading' | 'error'
  title: string
  details?: string
}

/** Полноэкранное сообщение: страница состоит из одного кадра, показывать состояние больше негде. */
export function StatusScreen({kind, title, details}: Props) {
  return (
    <div className={styles.screen} role={kind === 'error' ? 'alert' : 'status'}>
      {kind === 'loading' && <div className={styles.spinner} aria-hidden />}
      <p className={styles.title}>{title}</p>
      {details && <pre className={styles.details}>{details}</pre>}
    </div>
  )
}
