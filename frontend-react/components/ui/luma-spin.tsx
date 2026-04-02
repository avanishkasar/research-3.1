"use client";

export function LumaSpin() {
  return (
    <div className="relative aspect-square w-[56px]" aria-label="Loading" role="status">
      <span className="absolute rounded-[50px] animate-loaderAnim shadow-[inset_0_0_0_3px] shadow-gray-800 dark:shadow-gray-100" />
      <span className="absolute rounded-[50px] animate-loaderAnim animation-delay shadow-[inset_0_0_0_3px] shadow-gray-800 dark:shadow-gray-100" />
      <style jsx>{`
        @keyframes loaderAnim {
          0% { inset: 0 30px 30px 0; }
          12.5% { inset: 0 30px 0 0; }
          25% { inset: 30px 30px 0 0; }
          37.5% { inset: 30px 0 0 0; }
          50% { inset: 30px 0 0 30px; }
          62.5% { inset: 0 0 0 30px; }
          75% { inset: 0 0 30px 30px; }
          87.5% { inset: 0 0 30px 0; }
          100% { inset: 0 30px 30px 0; }
        }
        .animate-loaderAnim {
          animation: loaderAnim 2.2s infinite;
        }
        .animation-delay {
          animation-delay: -1.1s;
        }
      `}</style>
    </div>
  );
}
