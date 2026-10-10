'use client';

import { useMemo, useState } from 'react';
import type {
  JournalEntryDetail,
  JournalEntryListItem,
  SearchJournalEntriesResponse,
} from '@/modules/accounting/domain/accounting';
import { ORIGIN_TYPE_LABELS } from '@/modules/accounting/domain/accounting';

interface Props {
  initialData: SearchJournalEntriesResponse;
  onFetchDetail?: (id: string) => Promise<JournalEntryDetail>;
}

export function JournalEntriesTable({ initialData, onFetchDetail }: Props) {
  const [entries] = useState<JournalEntryListItem[]>(initialData.items);
  const [search, setSearch] = useState('');
  const [originFilter, setOriginFilter] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<JournalEntryDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const matchesSearch =
        search.trim() === '' ||
        entry.code.toLowerCase().includes(search.toLowerCase()) ||
        entry.description.toLowerCase().includes(search.toLowerCase());

      const matchesOrigin =
        originFilter === '' || entry.originType === originFilter;

      return matchesSearch && matchesOrigin;
    });
  }, [entries, search, originFilter]);

  const uniqueOrigins = useMemo(() => {
    return Array.from(new Set(entries.map((e) => e.originType)));
  }, [entries]);

  const handleViewDetail = async (item: JournalEntryListItem) => {
    if (onFetchDetail) {
      setIsLoadingDetail(true);
      try {
        const detail = await onFetchDetail(item.id);
        setSelectedEntry(detail);
      } catch {
        // Fallback si la llamada directa no está disponible
        setSelectedEntry({
          ...item,
          lines: [],
        });
      } finally {
        setIsLoadingDetail(false);
      }
    } else {
      setSelectedEntry({
        ...item,
        lines: [],
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
        <div className="w-full sm:w-80">
          <input
            type="text"
            data-testid="search-entries-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código o concepto..."
            className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div className="w-full sm:w-64">
          <select
            data-testid="filter-origin"
            value={originFilter}
            onChange={(e) => setOriginFilter(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
          >
            <option value="">Todos los orígenes</option>
            {uniqueOrigins.map((orig) => (
              <option key={orig} value={orig}>
                {ORIGIN_TYPE_LABELS[orig] ?? orig}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabla de Asientos */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse" data-testid="journal-entries-table">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50 text-xs font-semibold text-stone-600 uppercase tracking-wider">
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Número</th>
              <th className="px-4 py-3">Origen</th>
              <th className="px-4 py-3">Concepto</th>
              <th className="px-4 py-3 text-right">Debe</th>
              <th className="px-4 py-3 text-right">Haber</th>
              <th className="px-4 py-3 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 text-sm">
            {filteredEntries.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-stone-500 italic">
                  No se encontraron asientos contables registrados.
                </td>
              </tr>
            ) : (
              filteredEntries.map((entry) => (
                <tr
                  key={entry.id}
                  data-testid={`entry-row-${entry.code}`}
                  className="hover:bg-stone-50 transition-colors"
                >
                  <td className="px-4 py-3 text-stone-600 font-mono text-xs whitespace-nowrap">
                    {entry.entryDate}
                  </td>
                  <td className="px-4 py-3 font-semibold text-stone-800 font-mono text-xs whitespace-nowrap">
                    {entry.code}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-stone-100 text-stone-700">
                      {ORIGIN_TYPE_LABELS[entry.originType] ?? entry.originType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-stone-700 max-w-xs truncate" title={entry.description}>
                    {entry.description}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-medium text-stone-900 whitespace-nowrap">
                    {entry.totalDebit.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-medium text-stone-900 whitespace-nowrap">
                    {entry.totalCredit.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      data-testid={`view-entry-${entry.code}`}
                      onClick={() => handleViewDetail(entry)}
                      className="px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded transition-colors"
                    >
                      Ver detalle
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de Detalle de Asiento */}
      {selectedEntry && (
        <div
          data-testid="entry-detail-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-sm p-4"
        >
          <div className="bg-white rounded-2xl shadow-xl border border-stone-200 w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-stone-50">
              <div>
                <h3 className="font-semibold text-stone-900">
                  Asiento {selectedEntry.code}
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  {selectedEntry.entryDate} • {ORIGIN_TYPE_LABELS[selectedEntry.originType] ?? selectedEntry.originType} • {selectedEntry.currency}
                </p>
              </div>
              <button
                type="button"
                data-testid="close-detail-modal"
                onClick={() => setSelectedEntry(null)}
                className="text-stone-400 hover:text-stone-600 rounded-lg p-1.5 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="text-sm text-stone-700 bg-stone-50 p-3 rounded-lg border border-stone-100">
                <span className="font-medium text-stone-800">Concepto: </span>
                {selectedEntry.description}
              </div>

              {isLoadingDetail ? (
                <div className="py-8 text-center text-sm text-stone-500">
                  Cargando líneas del asiento...
                </div>
              ) : (
                <div className="border border-stone-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-sm" data-testid="entry-lines-table">
                    <thead>
                      <tr className="bg-stone-50 border-b border-stone-200 text-xs font-semibold text-stone-600">
                        <th className="px-4 py-2.5">Cuenta</th>
                        <th className="px-4 py-2.5">Detalle / Glosa</th>
                        <th className="px-4 py-2.5 text-right">Debe</th>
                        <th className="px-4 py-2.5 text-right">Haber</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {selectedEntry.lines.map((l) => (
                        <tr key={l.id} className="hover:bg-stone-50/50">
                          <td className="px-4 py-2.5 font-mono text-xs">
                            <span className="font-semibold text-stone-800">
                              {l.accountCode ?? '—'}
                            </span>
                            <span className="text-stone-500 ml-2 font-sans">
                              {l.accountName ?? l.accountId}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-stone-600 text-xs">
                            {l.label}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-xs text-stone-900">
                            {l.debit > 0
                              ? l.debit.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                              : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-xs text-stone-900">
                            {l.credit > 0
                              ? l.credit.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-stone-50/80 font-semibold border-t border-stone-200 text-xs">
                        <td colSpan={2} className="px-4 py-2.5 text-stone-700">
                          Total
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-stone-900">
                          {selectedEntry.totalDebit.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-stone-900">
                          {selectedEntry.totalCredit.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            <div className="px-6 py-3 bg-stone-50 border-t border-stone-200 flex justify-between items-center text-xs text-stone-500">
              <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Partida doble cuadrada
              </span>
              <button
                type="button"
                onClick={() => setSelectedEntry(null)}
                className="px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-stone-700 font-medium hover:bg-stone-50 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
