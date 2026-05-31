export default function InfoCard({ title, icon: Icon, action, children, accent }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {(title || Icon || action) && (
        <div className={`flex items-center justify-between px-5 py-4 border-b border-slate-100 ${accent ? "bg-sky-50" : ""}`}>
          <div className="flex items-center gap-2.5 min-w-0">
            {Icon && <Icon className="w-4 h-4 text-sky-600 flex-shrink-0" />}
            {title && (
              <h2 className="text-sm font-semibold text-slate-800 truncate">
                {title}
              </h2>
            )}
          </div>
          {action && <div className="flex-shrink-0 ml-3">{action}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}
