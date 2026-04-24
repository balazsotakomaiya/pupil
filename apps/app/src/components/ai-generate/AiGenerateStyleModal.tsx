import { useEffect } from "react";
import styles from "./AiGenerate.module.css";
import { CloseIcon } from "./AiGenerateIcons";

type AiGenerateStyleModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const STYLE_CARDS = [
  {
    badge: "Term → Definition",
    description:
      "The front names a concept. The back gives a clear, self-contained definition. Best for vocabulary, terminology, and core ideas.",
    exampleBack:
      "An optimization algorithm that iteratively adjusts parameters in the direction of steepest decrease of the loss function.",
    exampleFront: "Gradient descent",
    name: "Concept",
  },
  {
    badge: "Question → Answer",
    description:
      "The front asks a specific question targeting one fact. The back gives a concise, direct answer. Best for testing understanding and application.",
    exampleBack:
      "Because self-attention is permutation-invariant. It has no built-in notion of token order.",
    exampleFront: "Why do transformers use positional encoding?",
    name: "Q&A",
  },
  {
    badge: "Fill in the blank",
    description:
      "The front is a sentence with a key term removed. The back gives the missing term plus a short explanation. Best for facts, names, and values.",
    exampleBack:
      "d_k — the dimension of the key vectors. This keeps the dot products from growing too large.",
    exampleFront: "The scaling factor in attention is 1 / square root of ____.",
    name: "Cloze",
  },
] as const;

export function AiGenerateStyleModal({ isOpen, onClose }: AiGenerateStyleModalProps) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      aria-modal="true"
      className={`${styles.aiGenModalOverlay} ${styles.open}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
    >
      <div className={styles.aiGenModal}>
        <div className={styles.aiGenModalHeader}>
          <span className={styles.aiGenModalTitle}>Card styles</span>
          <button
            aria-label="Close style guide"
            className={styles.aiGenModalClose}
            onClick={onClose}
            type="button"
          >
            <CloseIcon />
          </button>
        </div>
        <div className={styles.aiGenModalBody}>
          <div className={styles.aiGenStyleExplain}>
            {STYLE_CARDS.map((styleCard) => (
              <div className={styles.aiGenStyleCard} key={styleCard.name}>
                <div className={styles.aiGenStyleCardHeader}>
                  <span className={styles.aiGenStyleCardName}>{styleCard.name}</span>
                  <span className={styles.aiGenStyleCardBadge}>{styleCard.badge}</span>
                </div>
                <div className={styles.aiGenStyleCardDesc}>{styleCard.description}</div>
                <div className={styles.aiGenStyleCardExample}>
                  <div className={styles.aiGenStyleExampleLabel}>Example</div>
                  <div className={styles.aiGenStyleExamplePair}>
                    <span className={styles.aiGenStyleExampleSide}>F</span>
                    <span className={styles.aiGenStyleExampleText}>
                      <strong>{styleCard.exampleFront}</strong>
                    </span>
                    <span className={styles.aiGenStyleExampleSide}>B</span>
                    <span className={styles.aiGenStyleExampleText}>{styleCard.exampleBack}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
