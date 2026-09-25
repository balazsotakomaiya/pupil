import { AppleIcon, TuxIcon, WindowsIcon } from "../icons";
import styles from "./Platforms.module.css";

const PLATFORMS = [
  { name: "macOS", Icon: AppleIcon },
  { name: "Windows", Icon: WindowsIcon },
  { name: "Linux", Icon: TuxIcon },
];

export default function Platforms({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className={styles.platforms}>
        <span className={styles.label}>Available on</span>
        <ul className={styles.list}>
          {PLATFORMS.map(({ name, Icon }) => (
            <li key={name} className={styles.item}>
              <Icon size={17} />
              {name}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
