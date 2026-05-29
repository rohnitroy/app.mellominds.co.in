import React from 'react';
import styles from './Loader.module.css';

interface LoaderProps {
  fullScreen?: boolean; // true = centered in viewport, false = inline
  text?: string;
}

const Loader: React.FC<LoaderProps> = ({ fullScreen = false, text }) => {
  return (
    <div className={fullScreen ? styles.fullScreen : styles.inline}>
      <div className={styles.wrapper}>
        <div className={styles.logo}>
          <img src="/MelloFevicon 1.png" alt="Mello" className={styles.logoImg} />
        </div>
        <div className={styles.dots}>
          <span className={styles.dot} />
          <span className={styles.dot} />
          <span className={styles.dot} />
        </div>
        {text && <p className={styles.text}>{text}</p>}
      </div>
    </div>
  );
};

export default Loader;
