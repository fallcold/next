import styles from './page.module.css';

export default function HomePage() {
  const stars = Array.from({ length: 48 });

  return (
    <main className={styles.spaceScene}>
      <section className={styles.system} aria-label="星环行星动画">
        <div className={styles.orbit} />
        <div className={styles.planet} />
        <div className={styles.starRing} aria-hidden="true">
          {stars.map((_, index) => {
            const angle = (index / stars.length) * 360;
            const delay = -(index * 0.18);
            const size = 2 + (index % 3);

            return (
              <span
                key={index}
                className={styles.star}
                style={{
                  '--angle': `${angle}deg`,
                  '--delay': `${delay}s`,
                  '--size': `${size}px`,
                }}
              />
            );
          })}
        </div>
      </section>
    </main>
  );
}
