import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';

import ContentDialog from '../../molecules/dialog/ContentDialog';
import EmptyState from '../../atoms/EmptyState';
import Button from '../../atoms/Button';
import { useI18n } from '../../../i18n';
import {
  buildTaskReport,
  reportToMarkdown,
  reportToPlainText,
  type ReportLabels,
} from '../../../utils/taskReport';
import type { BoardData } from '../../../types/task.type';

interface ProgressReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  boardTitle: string;
  boardData: BoardData;
}

type CopyState = 'idle' | 'copied' | 'failed';
type ReportFormat = 'markdown' | 'plain';

function ProgressReportDialog({
  isOpen,
  onClose,
  boardTitle,
  boardData,
}: ProgressReportDialogProps) {
  const { t } = useI18n();
  const [reportFormat, setReportFormat] = useState<ReportFormat>('markdown');
  const [copyState, setCopyState] = useState<CopyState>('idle');

  const report = useMemo(
    () => buildTaskReport({ boardTitle, boardData }),
    [boardTitle, boardData],
  );

  const labels = useMemo<ReportLabels>(() => ({
    boardTitle: t('report.boardTitleLabel'),
    generatedAt: t('report.generatedAt'),
    total: t('report.total'),
    done: t('report.done'),
    remaining: t('report.remaining'),
    overdue: t('report.overdue'),
    unassigned: t('report.unassigned'),
    byAssignee: t('report.byAssignee'),
    assignee: t('report.assignee'),
    noAssignee: t('report.noAssignee'),
    summary: t('report.summary'),
  }), [t]);

  if (!isOpen) {
    return null;
  }

  const generatedLabel = (() => {
    try {
      return format(parseISO(report.generatedAt), 'yyyy-MM-dd HH:mm');
    } catch {
      return report.generatedAt;
    }
  })();

  const handleClose = () => {
    setCopyState('idle');
    onClose();
  };

  const handleCopy = async () => {
    const text = reportFormat === 'markdown'
      ? reportToMarkdown(report, labels)
      : reportToPlainText(report, labels);

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard API unavailable');
      }
      await navigator.clipboard.writeText(text);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  };

  const handleFormatChange = (nextFormat: ReportFormat) => {
    setReportFormat(nextFormat);
    setCopyState('idle');
  };

  const statTiles: Array<{ key: string; label: string; value: number; valueClass: string; accentClass: string }> = [
    { key: 'total', label: t('report.total'), value: report.total, valueClass: 'text-[var(--app-text)]', accentClass: 'border-t-slate-300' },
    { key: 'done', label: t('report.done'), value: report.done, valueClass: 'text-emerald-700', accentClass: 'border-t-emerald-400' },
    { key: 'remaining', label: t('report.remaining'), value: report.remaining, valueClass: 'text-sky-700', accentClass: 'border-t-sky-400' },
    { key: 'overdue', label: t('report.overdue'), value: report.overdue, valueClass: 'text-rose-700', accentClass: 'border-t-rose-400' },
    { key: 'unassigned', label: t('report.unassigned'), value: report.unassigned, valueClass: 'text-[var(--app-text-muted)]', accentClass: 'border-t-amber-400' },
  ];

  const formatToggleClass = (mode: ReportFormat) => (
    `cursor-pointer rounded-[var(--app-radius-sm)] px-3 py-1 text-xs font-semibold transition-[background-color,color,box-shadow] duration-[var(--app-motion-fast)] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
      reportFormat === mode
        ? 'bg-[var(--app-surface)] text-[var(--app-text)] shadow-sm'
        : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
    }`
  );

  return (
    <ContentDialog
      onSubmit={() => {}}
      onClose={handleClose}
      scrimClassName="bg-slate-900/60 backdrop-blur-sm"
      title={(
        <div className="-mx-6 mb-6 flex items-center justify-between border-b border-[var(--app-border)] px-6 pb-4">
          <h3 className="flex items-center gap-2 text-xl font-bold text-[var(--app-text)]">
            <svg className="h-6 w-6 text-blue-500" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6m6 6V5m-9 14v-2m12 2V9" />
            </svg>
            {t('report.title')}
          </h3>
          <button
            type="button"
            onClick={handleClose}
            aria-label={t('common.close')}
            title={t('common.close')}
            className="cursor-pointer rounded-[var(--app-radius-md)] text-[var(--app-text-muted)] transition-colors duration-[var(--app-motion-fast)] hover:text-[var(--app-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
          >
            <svg className="h-6 w-6" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
      className="max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6 ring-1 ring-black/5 !rounded-[var(--app-radius-lg)] !bg-[var(--app-surface)] !shadow-[var(--app-shadow-overlay)]"
      modalFooter={(
        <div className="-mx-6 mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--app-border)] px-6 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-[var(--app-radius-md)] border border-[var(--app-border)] bg-[var(--app-muted)] p-0.5">
              <button type="button" onClick={() => handleFormatChange('markdown')} className={formatToggleClass('markdown')}>
                {t('report.copyMarkdown')}
              </button>
              <button type="button" onClick={() => handleFormatChange('plain')} className={formatToggleClass('plain')}>
                {t('report.copyPlainText')}
              </button>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex cursor-pointer items-center gap-2 rounded-[var(--app-radius-md)] bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-[background-color,box-shadow] duration-[var(--app-motion-fast)] hover:bg-blue-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
            >
              <svg className="h-4 w-4" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              {t('report.copy')}
            </button>
            {copyState === 'copied' && (
              <span className="text-xs font-semibold text-emerald-600">{t('report.copied')}</span>
            )}
            {copyState === 'failed' && (
              <span className="text-xs font-semibold text-rose-600">{t('report.copyFailed')}</span>
            )}
          </div>
          <Button text={t('common.close')} variant="outline" onClick={handleClose} />
        </div>
      )}
    >
      <div className="min-h-[200px]">
        {report.total === 0 ? (
          <EmptyState
            title={t('report.empty')}
            description={t('report.emptyDescription')}
          />
        ) : (
          <div className="space-y-6">
            <div>
              <p className="text-sm font-semibold text-[var(--app-text)]">{report.boardTitle}</p>
              <p className="text-xs text-[var(--app-text-muted)]">{`${t('report.generatedAt')}: ${generatedLabel}`}</p>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {statTiles.map((tile) => (
                  <div
                    key={tile.key}
                    className={`rounded-[var(--app-radius-lg)] border border-[var(--app-border)] border-t-2 ${tile.accentClass} bg-[var(--app-card)] px-3.5 py-3 shadow-[var(--app-shadow-card)]`}
                  >
                    <p className="min-h-[1.75rem] text-[11px] font-semibold uppercase leading-tight tracking-wide text-[var(--app-text-muted)] line-clamp-2">
                      {tile.label}
                    </p>
                    <p className={`mt-1 text-2xl font-bold leading-none ${tile.valueClass}`}>{tile.value}</p>
                  </div>
                ))}
              </div>

              <p className="flex items-start gap-1.5 text-[11px] leading-4 text-[var(--app-text-muted)]">
                <svg className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 17a1 1 0 102 0 1 1 0 00-2 0zm.75-9.75a.75.75 0 00-1.5 0v.75a.75.75 0 001.5 0V7.25zM12 2.25c5.385 0 9.75 4.365 9.75 9.75S17.385 21.75 12 21.75 2.25 17.385 2.25 12 6.615 2.25 12 2.25z" />
                </svg>
                <span>{t('report.metricsHint')}</span>
              </p>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-bold text-[var(--app-text)]">{t('report.byAssignee')}</h4>
              {report.byAssignee.length === 0 ? (
                <EmptyState
                  compact
                  icon={(
                    <svg className="h-7 w-7" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4zm6 0a3 3 0 10-3-3 3 3 0 003 3z" />
                    </svg>
                  )}
                  title={t('report.noAssignee')}
                  description={t('report.noAssigneeDescription')}
                />
              ) : (
                <div className="overflow-hidden rounded-[var(--app-radius-lg)] border border-[var(--app-border)]">
                  <table className="w-full text-sm">
                    <thead className="bg-[var(--app-muted)] text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--app-text-muted)]">
                      <tr>
                        <th scope="col" className="px-4 py-2">{t('report.assignee')}</th>
                        <th scope="col" className="px-4 py-2 text-right">{t('report.total')}</th>
                        <th scope="col" className="px-4 py-2 text-right">{t('report.done')}</th>
                        <th scope="col" className="px-4 py-2 text-right">{t('common.overdue')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--app-border)]">
                      {report.byAssignee.map((stat) => (
                        <tr key={stat.name} className="transition-[background-color] duration-[var(--app-motion-fast)] hover:bg-[var(--app-muted)]">
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              {stat.avatar && (
                                <img
                                  src={stat.avatar}
                                  alt={stat.name}
                                  className="h-6 w-6 rounded-full object-cover"
                                />
                              )}
                              <span className="font-medium text-[var(--app-text)]">{stat.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2 text-right text-[var(--app-text)]">{stat.total}</td>
                          <td className="px-4 py-2 text-right text-emerald-700">{stat.done}</td>
                          <td className="px-4 py-2 text-right text-rose-700">{stat.overdue}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </ContentDialog>
  );
}

export default ProgressReportDialog;