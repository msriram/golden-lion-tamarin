const navToggle = document.querySelector('[data-nav-toggle]');
const nav = document.querySelector('[data-nav]');

if (navToggle && nav) {
  navToggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });
}

const currentPage = document.body.dataset.page;
if (currentPage) {
  document.querySelector(`[data-nav-link="${currentPage}"]`)?.setAttribute('aria-current', 'page');
}

const motionButton = document.querySelector('[data-motion-toggle]');
const reduceMotion = localStorage.getItem('goldenThreadsReduceMotion') === 'true';
document.documentElement.classList.toggle('reduce-motion', reduceMotion);

function updateMotionButton() {
  if (!motionButton) return;
  const isReduced = document.documentElement.classList.contains('reduce-motion');
  motionButton.setAttribute('aria-pressed', String(isReduced));
  motionButton.title = isReduced ? 'Use standard motion' : 'Reduce motion';
  motionButton.textContent = isReduced ? '◼' : '≈';
}

updateMotionButton();
motionButton?.addEventListener('click', () => {
  const enabled = !document.documentElement.classList.contains('reduce-motion');
  document.documentElement.classList.toggle('reduce-motion', enabled);
  localStorage.setItem('goldenThreadsReduceMotion', String(enabled));
  updateMotionButton();
});

const forestDemo = document.querySelector('[data-forest-demo]');
const forestDemoButton = document.querySelector('[data-forest-demo-toggle]');
if (forestDemo && forestDemoButton) {
  forestDemoButton.addEventListener('click', () => {
    const connected = forestDemo.classList.toggle('connected');
    forestDemoButton.setAttribute('aria-pressed', String(connected));
    forestDemoButton.textContent = connected ? 'Separate the patches' : 'Connect the patches';
  });
}

const careQuiz = document.querySelector('[data-care-quiz]');
if (careQuiz) {
  const answer = careQuiz.querySelector('[data-quiz-answer]');
  careQuiz.querySelectorAll('[data-care-choice]').forEach((button) => {
    button.addEventListener('click', () => {
      careQuiz.querySelectorAll('[data-care-choice]').forEach((choice) => choice.setAttribute('aria-pressed', 'false'));
      button.setAttribute('aria-pressed', 'true');
      const choice = button.dataset.careChoice;
      const messages = {
        mother: 'Mothers nurse the infants and carry them, especially early on—but care is shared.',
        father: 'Fathers often do a large share of carrying, but they are not the only helpers.',
        family: 'Right! Mothers nurse, while fathers, siblings, and other group members can help carry and protect twins.'
      };
      answer.hidden = false;
      answer.textContent = messages[choice];
    });
  });
}

document.querySelectorAll('[data-print]').forEach((button) => {
  button.addEventListener('click', () => window.print());
});
