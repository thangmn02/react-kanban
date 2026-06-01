import { BOARD_TEMPLATES } from '../../data/boardTemplates';
import Typography from '../atoms/Typography';

interface BoardTemplatePickerProps {
  selectedTemplateId: string;
  onTemplateChange: (templateId: string) => void;
  name?: string;
}

export default function BoardTemplatePicker({
  selectedTemplateId,
  onTemplateChange,
  name = 'templateId',
}: BoardTemplatePickerProps) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {BOARD_TEMPLATES.map((template) => {
        const isSelected = selectedTemplateId === template.id;

        return (
          <label
            key={template.id}
            className={`cursor-pointer rounded-2xl border p-4 transition-[background,border,box-shadow,transform] hover:-translate-y-0.5 focus-within:outline-none focus-within:ring-4 focus-within:ring-sky-100 ${
              isSelected
                ? 'border-blue-500 bg-blue-50 shadow-sm'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <input
              type="radio"
              name={name}
              value={template.id}
              checked={isSelected}
              onChange={() => onTemplateChange(template.id)}
              className="sr-only"
            />
            <div className="flex items-start justify-between gap-3">
              <div>
                <Typography
                  component="p"
                  content={template.name}
                  className="text-sm font-semibold text-gray-900"
                />
                <Typography
                  component="p"
                  content={template.description}
                  className="mt-1 text-xs leading-5 text-gray-500"
                />
              </div>
              {isSelected && (
                <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                  Active
                </span>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {template.lists.map((listTitle) => (
                <span
                  key={listTitle}
                  className="rounded-full border border-gray-200 bg-white/80 px-2.5 py-1 text-[11px] font-medium text-gray-600"
                >
                  {listTitle}
                </span>
              ))}
            </div>
          </label>
        );
      })}
    </div>
  );
}
