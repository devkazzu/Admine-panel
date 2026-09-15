/**
 * RJNX Website → Projects: CRUD with draft/publish workflow.
 */
import { FolderGit2, Star } from 'lucide-react';
import { CrudPage, type FieldDef } from '../../components/crud/CrudPage';
import { Badge } from '../../components/ui/primitives';
import { PROJECT_STATUS } from '../../lib/constants';

const fields: FieldDef[] = [
  { name: 'name', label: 'Project name', type: 'text', required: true, placeholder: 'My awesome project' },
  { name: 'slug', label: 'Slug', type: 'text', placeholder: 'auto-generated from name', help: 'Leave empty to auto-generate.' },
  { name: 'status', label: 'Status', type: 'select', options: [
    { value: 'draft', label: 'Draft' },
    { value: 'published', label: 'Published' },
  ], defaultValue: 'draft' },
  { name: 'featured', label: 'Featured', type: 'switch', defaultValue: false, help: 'Featured projects appear first on the public site.' },
  { name: 'image', label: 'Cover image', type: 'image' },
  { name: 'technologies', label: 'Technologies', type: 'tags', placeholder: 'e.g. React' },
  { name: 'github_url', label: 'GitHub URL', type: 'url', placeholder: 'https://github.com/…' },
  { name: 'live_url', label: 'Live URL', type: 'url', placeholder: 'https://…' },
  { name: 'sort_order', label: 'Sort order', type: 'number', defaultValue: 0 },
  { name: 'description', label: 'Description', type: 'textarea', rows: 4 },
];

export function ProjectsPage() {
  return (
    <CrudPage
      title="Projects"
      description="Portfolio projects shown on the RJNX personal website. Only published projects appear publicly."
      endpoint="/api/admin/website/projects"
      resource="projects"
      createLabel="New project"
      searchPlaceholder="Search projects…"
      fields={fields}
      defaults={{ status: 'draft', featured: false, technologies: [], sort_order: 0 }}
      filters={[{ name: 'status', options: Object.entries(PROJECT_STATUS).map(([value, m]) => ({ value, label: m.label })) }]}
      emptyIcon={FolderGit2}
      columns={[
        {
          key: 'name',
          label: 'Project',
          render: (row) => (
            <div className="flex items-center gap-3">
              {row.image ? (
                <img src={row.image} alt="" className="h-9 w-12 shrink-0 rounded object-cover ring-1 ring-white/10" />
              ) : (
                <div className="flex h-9 w-12 shrink-0 items-center justify-center rounded bg-white/5 ring-1 ring-white/10">
                  <FolderGit2 size={14} className="text-zinc-600" />
                </div>
              )}
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 truncate font-medium text-zinc-100">
                  {row.name}
                  {row.featured ? <Star size={12} className="shrink-0 text-amber-400" fill="currentColor" /> : null}
                </p>
                <p className="truncate text-xs text-zinc-600">/{row.slug}</p>
              </div>
            </div>
          ),
        },
        {
          key: 'technologies',
          label: 'Tech',
          render: (row) => (
            <div className="flex max-w-xs flex-wrap gap-1">
              {(row.technologies ?? []).slice(0, 4).map((t: string) => (
                <span key={t} className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-zinc-400">
                  {t}
                </span>
              ))}
              {(row.technologies ?? []).length > 4 && <span className="text-[10px] text-zinc-600">+{row.technologies.length - 4}</span>}
            </div>
          ),
        },
        {
          key: 'links',
          label: 'Links',
          render: (row) => (
            <div className="flex gap-2 text-xs">
              {row.github_url ? (
                <a href={row.github_url} target="_blank" rel="noreferrer" className="text-violet-400 hover:text-violet-300">
                  GitHub
                </a>
              ) : (
                <span className="text-zinc-700">GitHub</span>
              )}
              {row.live_url ? (
                <a href={row.live_url} target="_blank" rel="noreferrer" className="text-violet-400 hover:text-violet-300">
                  Live
                </a>
              ) : (
                <span className="text-zinc-700">Live</span>
              )}
            </div>
          ),
        },
        { key: 'status', label: 'Status', render: (row) => <Badge tone={PROJECT_STATUS[row.status]?.tone}>{PROJECT_STATUS[row.status]?.label}</Badge> },
      ]}
    />
  );
}
