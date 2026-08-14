/* BALAJI worker-face loader + MutationObserver loop fix
   The previous worker-face build watched #workersList with subtree:true while
   rewriting the attendance panel inside each card. That caused a DOM mutation
   feedback loop and made the admin dashboard appear stuck on Loading.
*/
(()=>{
  'use strict';

  const ORIGINAL = 'https://raw.githubusercontent.com/Balajicontruction/balaji-construction-services/cd989bbbb56da944d38456a82c604bfbf389ff52/worker-face.js';

  // Keep the existing worker-face/payment implementation intact, but prevent
  // its attendance observer from observing the panel it writes itself.
  const NativeMutationObserver = window.MutationObserver;
  if (NativeMutationObserver && !NativeMutationObserver.__balajiPatched) {
    const OriginalObserver = NativeMutationObserver;
    class SafeMutationObserver extends OriginalObserver {
      observe(target, options) {
        if (target && target.id === 'workersList' && options && options.subtree) {
          options = {...options, subtree:false};
        }
        return super.observe(target, options);
      }
    }
    SafeMutationObserver.__balajiPatched = true;
    window.MutationObserver = SafeMutationObserver;
  }

  fetch(ORIGINAL, {cache:'no-store'})
    .then(r=>{
      if(!r.ok) throw new Error('worker-face source load failed: '+r.status);
      return r.text();
    })
    .then(code=>{
      // Avoid loading this small wrapper recursively.
      (0,eval)(code);
    })
    .catch(err=>{
      console.error('Worker face module load failed:', err);
    });
})();
