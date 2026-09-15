/**
 * Config-driven CRUD page: list + search + filters + pagination + create/edit
 * modal + delete confirmation + toasts. One component powers Projects, Social
 * Links, Teams, Players, Tournaments, Achievements, Recruitment and Admin
 * Users, guaranteeing a consistent UI and behaviour everywhere.
 */
import { Pencil, Plus, Trash2, type LucideIcon } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { api, ApiError } from '../../lib/api';
import { useApiQuery, useDebounce } from '../../lib/hooks';
import { fromLocalInput, toLocalInput } from '../../lib/format';
import type { ListResponse } from '../../lib/types';
import { DataTable, ListToolbar, type Column } from '../ui/DataTable';
import { Modal, ConfirmDialog } from '../ui/Modal';
import { Button, FormField, Input, PageHeader, Select, Switch, Textarea } from '../ui/primitives';
import { ImageInput, SkillsInput, SocialLinksInput, StatsInput, TagInput } from '../ui/inputs';
import { useToast } from '../ui/Toast';
import { useAuth } from '../../auth/AuthContext';

export interface FieldDef {
  name: string;
  label: string;
  type:
    | 'text' | 'url' | 'textarea' | 'number' | 'select' | 'date' | 'datetime'
    | 'image' | 'tags' | 'socials' | 'stats' | 'skills' | 'switch' | 'password';
  options?: { value: string | number; label: string }[];
  numeric?: boolean;          // select: send value as number
  placeholder?: string;
  required?: boolean;
  help?: string;
  rows?: number;
  colSpan?: 1 | 2;
  defaultValue?: unknown;
  createOnly?: boolean;
  editOnly?: boolean;
  circular?: boolean;
  labelName?: string;
  valueName?: string;
}

export function serializeForm(fields: FieldDef[], values: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const f of fields) {
    const v = values[f.name];
    switch (f.type) {
      case 'number':
        out[f.name] = v === '' || v === null || v === undefined ? null : Number(v);
        break;
      case 'select':
        out[f.name] = f.numeric ? (v === '' || v === undefined ? null : Number(v)) : v ?? '';
        break;
      case 'datetime':
        out[f.name] = fromLocalInput(v ?? '');
        break;
      case 'switch':
        out[f.name] = Boolean(v);
        break;
      case 'password':
        if (typeof v === 'string' && v !== '') out[f.name] = v;
        break;
      default:
        out[f.name] = v ?? '';
    }
  }
  return out;
}

export function rowToForm(fields: FieldDef[], row: any): Record<string, any> {
  const out: Record<string, any> = {};
  for (const f of fields) {
    let v = row?.[f.name] ?? f.defaultValue ?? '';
    if (f.type === 'datetime') v = toLocalInput(v);
    if (f.type === 'switch') v = Boolean(v);
    if (f.type === 'select' && f.numeric) v = v === null || v === undefined ? '' : String(v);
    out[f.name] = v;
  }
  return out;
}

export function FormFieldsGrid({
  fields,
  values,
  errors,
  setValues,
  isEdit,
}: {
  fields: FieldDef[];
  values: Record<string, any>;
  errors: Record<string, string>;
  setValues: (values: Record<string, any>) => void;
  isEdit: boolean;
}) {
  const visible = fields.filter((f) => (isEdit ? !f.createOnly : !f.editOnly));
  const set = (name: string, value: unknown) => setValues({ ...values, [name]: value });

  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
      {visible.map((f) => {
        const error = errors[f.name];
        const wrap = f.colSpan === 2 || f.type === 'textarea' || f.type === 'socials' || f.type === 'stats' || f.type === 'skills' || f.type === 'tags' || f.type === 'image';
        return (
          <div key={f.name} className={wrap ? 'sm:col-span-2' : ''}>
            {f.type === 'image' ? (
              <ImageInput
                label={f.label}
                error={error}
                help={f.help}
                value={values[f.name] ?? ''}
                onChange={(v) => set(f.name, v)}
                circular={f.circular}
              />
            ) : f.type === 'switch' ? (
              <FormField label={f.label} error={error} help={f.help}>
                <div className="flex h-9 items-center gap-3">
                  <Switch checked={Boolean(values[f.name])} onChange={(v) => set(f.name, v)} label={f.label} />
                  <span className="text-sm text-zinc-400">{values[f.name] ? 'Yes' : 'No'}</span>
                </div>
              </FormField>
            ) : f.type === 'tags' ? (
              <FormField label={f.label} error={error} help={f.help} required={f.required}>
                <TagInput value={values[f.name] ?? []} onChange={(v) => set(f.name, v)} placeholder={f.placeholder} />
              </FormField>
            ) : f.type === 'socials' ? (
              <FormField label={f.label} error={error} help={f.help}>
                <SocialLinksInput value={values[f.name] ?? {}} onChange={(v) => set(f.name, v)} />
              </FormField>
            ) : f.type === 'stats' ? (
              <FormField label={f.label} error={error} help={f.help}>
                <StatsInput value={values[f.name] ?? []} onChange={(v) => set(f.name, v)} labelName={f.labelName} valueName={f.valueName} />
              </FormField>
            ) : f.type === 'skills' ? (
              <FormField label={f.label} error={error} help={f.help}>
                <SkillsInput value={values[f.name] ?? []} onChange={(v) => set(f.name, v)} />
              </FormField>
            ) : f.type === 'textarea' ? (
              <FormField label={f.label} error={error} help={f.help} required={f.required}>
                <Textarea
                  rows={f.rows ?? 4}
                  value={values[f.name] ?? ''}
                  invalid={!!error}
                  placeholder={f.placeholder}
                  onChange={(e) => set(f.name, e.target.value)}
                />
              </FormField>
            ) : f.type === 'select' ? (
              <FormField label={f.label} error={error} help={f.help} required={f.required}>
                <Select value={values[f.name] ?? ''} invalid={!!error} onChange={(e) => set(f.name, e.target.value)}>
                  {!f.required && <option value="">— None —</option>}
                  {(f.options ?? []).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </FormField>
            ) : (
              <FormField label={f.label} error={error} help={f.help} required={f.required}>
                <Input
                  type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : f.type === 'datetime' ? 'datetime-local' : f.type === 'password' ? 'password' : 'text'}
                  value={values[f.name] ?? ''}
                  invalid={!!error}
                  placeholder={f.placeholder}
                  min={f.type === 'number' ? 0 : undefined}
                  onChange={(e) => set(f.name, e.target.value)}
                />
              </FormField>
            )}
          </div>
        );
      })}
    </div>
  );
}

export interface CrudPageProps {
  title: string;
  description?: string;
  endpoint: string;
  resource: string;
  columns: Column<any>[];
  fields: FieldDef[];
  defaults: Record<string, any>;
  filters?: { name: string; label?: string; options: { value: string; label: string }[] }[];
  searchPlaceholder?: string;
  searchEnabled?: boolean;
  toForm?: (row: any) => Record<string, any>;
  rowActions?: (row: any, reload: () => void) => ReactNode;
  listQuery?: Record<string, string>;
  modalSize?: 'sm' | 'md' | 'lg' | 'xl';
  createLabel?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: LucideIcon;
  onSaved?: () => void;
}

export function CrudPage({
  title,
  description,
  endpoint,
  resource,
  columns,
  fields,
  defaults,
  filters,
  searchPlaceholder,
  searchEnabled = true,
  toForm,
  rowActions,
  listQuery,
  modalSize = 'md',
  createLabel = 'Create',
  emptyTitle,
  emptyDescription,
  emptyIcon,
  onSaved,
}: CrudPageProps) {
  const { hasPerm } = useAuth();
  const { success, error: toastError } = useToast();
  const canWrite = hasPerm(`${resource}:write`);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 350);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; row: any } | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  const query = useMemo(
    () => ({
      ...(listQuery ?? {}),
      ...(searchEnabled && debouncedSearch ? { q: debouncedSearch } : {}),
      ...filterValues,
      page,
      perPage: 20,
    }),
    [listQuery, debouncedSearch, filterValues, page],
  );

  const { data, loading, error, refetch } = useApiQuery(() => api.list<any>(endpoint, query), [query]);

  const openCreate = () => {
    setValues(rowToForm(fields, null));
    setFormErrors({});
    setModal({ mode: 'create', row: null });
  };

  const openEdit = (row: any) => {
    setValues(toForm ? toForm(row) : rowToForm(fields, row));
    setFormErrors({});
    setModal({ mode: 'edit', row });
  };

  const submit = async () => {
    if (!modal) return;
    setSaving(true);
    setFormErrors({});
    try {
      const payload = serializeForm(fields, values);
      if (modal.mode === 'create') {
        await api.post(endpoint, payload);
        success('Created successfully');
      } else {
        await api.patch(`${endpoint}/${modal.row.id}`, payload);
        success('Saved successfully');
      }
      setModal(null);
      refetch();
      onSaved?.();
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setFormErrors(err.fieldErrors());
        toastError('Please fix the highlighted fields');
      } else {
        toastError(err instanceof ApiError ? err.message : 'Something went wrong');
      }
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.del(`${endpoint}/${deleteTarget.id}`);
      success('Deleted');
      setDeleteTarget(null);
      refetch();
      onSaved?.();
    } catch (err) {
      toastError(err instanceof ApiError ? err.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const reload = refetch;

  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        actions={canWrite ? (
          <Button variant="primary" onClick={openCreate}>
            <Plus size={15} /> {createLabel}
          </Button>
        ) : undefined}
      />

      <ListToolbar
        search={search}
        onSearch={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder={searchPlaceholder}
        filters={
          filters?.map((f) => (
            <Select
              key={f.name}
              value={filterValues[f.name] ?? ''}
              onChange={(e) => {
                setFilterValues((prev) => ({ ...prev, [f.name]: e.target.value }));
                setPage(1);
              }}
              className="w-auto min-w-[9rem]"
              aria-label={f.label ?? f.name}
            >
              <option value="">{f.label ?? f.name}: All</option>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          ))
        }
      />

      <DataTable
        columns={columns}
        rows={data?.data ?? null}
        loading={loading}
        error={error?.message ?? null}
        onRetry={refetch}
        meta={data?.meta ?? null}
        onPageChange={setPage}
        emptyTitle={emptyTitle ?? `No records yet`}
        emptyDescription={emptyDescription ?? (canWrite ? `Click “${createLabel}” to add the first one.` : 'Nothing has been added yet.')}
        emptyIcon={emptyIcon}
        emptyAction={canWrite ? (
          <Button variant="primary" size="sm" onClick={openCreate}>
            <Plus size={14} /> {createLabel}
          </Button>
        ) : undefined}
        rowActions={
          canWrite || rowActions
            ? (row) => (
                <>
                  {rowActions?.(row, reload)}
                  {canWrite && (
                    <Button size="icon" variant="ghost" onClick={() => openEdit(row)} aria-label="Edit" title="Edit">
                      <Pencil size={14} />
                    </Button>
                  )}
                  {canWrite && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setDeleteTarget(row)}
                      aria-label="Delete"
                      title="Delete"
                      className="hover:text-rose-400"
                    >
                      <Trash2 size={14} />
                    </Button>
                  )}
                </>
              )
            : undefined
        }
      />

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.mode === 'create' ? createLabel : `Edit ${title.replace(/s$/, '').toLowerCase()}`}
        size={modalSize}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(null)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submit} loading={saving}>
              {modal?.mode === 'create' ? 'Create' : 'Save changes'}
            </Button>
          </>
        }
      >
        <FormFieldsGrid fields={fields} values={values} errors={formErrors} setValues={setValues} isEdit={modal?.mode === 'edit'} />
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title="Delete record"
        message={
          <>
            Are you sure you want to delete{' '}
            <span className="font-medium text-zinc-200">
              “{deleteTarget?.name ?? deleteTarget?.title ?? deleteTarget?.gamer_tag ?? deleteTarget?.position ?? 'this record'}”
            </span>
            ? This action cannot be undone.
          </>
        }
      />
    </div>
  );
}
