import { useEffect, useState, useCallback, type ReactNode } from 'react';
import { TOKENS } from '../lib/tokens';
import { Glass } from '../components/Glass';
import { Icon, StarIcon } from '../components/Icon';
import { api } from '../lib/api';
import { hapticTap } from '../lib/telegram';
import type { TaskItem, TasksResponse } from '../types';

interface TasksProps {
  onToast: (msg: string) => void;
}

export function TasksScreen({ onToast }: TasksProps) {
  const [data, setData] = useState<TasksResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.tasks();
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onCheck = useCallback(
    async (task: TaskItem) => {
      if (busyId) return;
      hapticTap();
      // Если у таски есть URL — открываем его перед проверкой (юзер должен
      // успеть выполнить действие). Telegram WebApp откроет ссылку нативно.
      if (task.url && task.status === 'available') {
        try {
          window.Telegram?.WebApp?.openTelegramLink?.(task.url);
        } catch {
          /* noop */
        }
        try {
          window.open(task.url, '_blank', 'noopener,noreferrer');
        } catch {
          /* noop */
        }
      }
      setBusyId(task.id);
      try {
        const res = await api.checkTask(task.id);
        if (res.ok) {
          if (res.awarded && res.awarded > 0) {
            onToast(`+${res.awarded} stars`);
          } else if (res.alreadyCompleted) {
            onToast('Already completed');
          } else {
            onToast('Done');
          }
          // обновляем локально, без re-fetch
          setData((prev) =>
            prev
              ? {
                  items: prev.items.map((i) =>
                    i.id === task.id ? { ...i, status: 'completed' as const } : i,
                  ),
                  summary: {
                    ...prev.summary,
                    completedCount:
                      prev.summary.completedCount + (res.alreadyCompleted ? 0 : 1),
                    completedReward:
                      prev.summary.completedReward + (res.awarded ?? 0),
                  },
                }
              : prev,
          );
        } else {
          onToast(res.reason ?? res.error ?? 'Not yet');
        }
      } catch (e) {
        const err = e as Error & { body?: { reason?: string; error?: string } };
        onToast(err.body?.reason ?? err.body?.error ?? err.message ?? 'Failed');
      } finally {
        setBusyId(null);
      }
    },
    [busyId, onToast],
  );

  return (
    <div
      style={{
        padding: '0 18px 110px',
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
      }}
    >
      <Header />

      {loading && !data ? (
        <SkeletonBlock />
      ) : error && !data ? (
        <Glass radius={18} padding={16}>
          <div style={{ color: '#FF8B8B', fontSize: 14, fontWeight: 600 }}>
            Failed to load tasks
          </div>
          <div style={{ color: TOKENS.textMute, fontSize: 12, marginTop: 6 }}>{error}</div>
          <button onClick={() => void load()} style={retryBtnStyle}>
            Retry
          </button>
        </Glass>
      ) : data ? (
        <>
          <ProgressCard summary={data.summary} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.items.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                busy={busyId === t.id}
                onCheck={() => void onCheck(t)}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

// =====================================================
// Header — TASKS / Earn stars / subtitle
// =====================================================
function Header() {
  return (
    <div style={{ marginTop: 4 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 1.6,
          color: TOKENS.textMute,
          textTransform: 'uppercase',
        }}
      >
        Tasks
      </div>
      <div
        style={{
          fontSize: 32,
          fontWeight: 800,
          color: TOKENS.text,
          letterSpacing: -0.8,
          lineHeight: 1.05,
          marginTop: 4,
        }}
      >
        Earn stars
      </div>
      <div
        style={{
          fontSize: 14.5,
          color: TOKENS.textDim,
          lineHeight: 1.45,
          marginTop: 10,
        }}
      >
        Complete simple actions and we'll credit stars to your balance instantly.
      </div>
    </div>
  );
}

// =====================================================
// Progress card — PROGRESS / X of Y done / +N / progress bar
// =====================================================
function ProgressCard({ summary }: { summary: TasksResponse['summary'] }) {
  const pct =
    summary.totalCount > 0 ? Math.min(100, (summary.completedCount / summary.totalCount) * 100) : 0;

  return (
    <Glass
      radius={20}
      padding={18}
      intense
      style={{
        background:
          'linear-gradient(135deg, rgba(155,123,255,0.16), rgba(123,92,230,0.04))',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <Label>Progress</Label>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: TOKENS.text,
              letterSpacing: -0.4,
              marginTop: 6,
            }}
          >
            <span>{summary.completedCount}</span>
            <span style={{ color: TOKENS.textDim, fontWeight: 600 }}>
              {' '}
              of {summary.totalCount} done
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginTop: 6 }}>
          <StarIcon size={18} />
          <span
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: TOKENS.gold,
              letterSpacing: -0.4,
            }}
          >
            +{summary.completedReward}
          </span>
        </div>
      </div>

      {/* progress bar */}
      <div
        style={{
          marginTop: 14,
          height: 6,
          borderRadius: 999,
          background: 'rgba(255,255,255,0.08)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            width: `${pct}%`,
            background:
              'linear-gradient(90deg, #9B7BFF 0%, #C9A6FF 50%, #F2C66B 100%)',
            borderRadius: 999,
            transition: 'width 320ms cubic-bezier(0.65,0,0.35,1)',
            boxShadow: '0 0 12px rgba(155,123,255,0.45)',
          }}
        />
      </div>
    </Glass>
  );
}

// =====================================================
// Task card — icon | title + reward pill + subtitle | action
// =====================================================
function TaskCard({
  task,
  busy,
  onCheck,
}: {
  task: TaskItem;
  busy: boolean;
  onCheck: () => void;
}) {
  const isCompleted = task.status === 'completed';

  return (
    <Glass
      radius={16}
      padding="12px 14px"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        opacity: isCompleted ? 0.62 : 1,
        transition: 'opacity 220ms ease',
      }}
    >
      {/* icon block */}
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 13,
          background: 'rgba(155,123,255,0.14)',
          border: `1px solid ${TOKENS.glassBorder}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        <Icon name={task.iconKind} size={22} color={TOKENS.violet} strokeWidth={1.7} />
      </div>

      {/* text block */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: TOKENS.text,
            letterSpacing: -0.1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {task.title}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 5,
          }}
        >
          {/* reward pill */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              padding: '2px 7px 2px 6px',
              borderRadius: 6,
              background: 'rgba(242,198,107,0.14)',
              border: '1px solid rgba(242,198,107,0.28)',
              flexShrink: 0,
            }}
          >
            <StarIcon size={11} glow={false} />
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 800,
                color: TOKENS.gold,
                letterSpacing: 0.1,
              }}
            >
              +{task.reward}
            </span>
          </div>
          <div
            style={{
              fontSize: 12.5,
              color: TOKENS.textMute,
              fontWeight: 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
            }}
          >
            {task.subtitle}
          </div>
        </div>
      </div>

      {/* action */}
      <div style={{ flexShrink: 0 }}>
        {isCompleted ? (
          <DoneCircle />
        ) : busy ? (
          <Spinner />
        ) : (
          <button
            onClick={onCheck}
            style={{
              height: 38,
              padding: '0 18px',
              borderRadius: 10,
              border: 'none',
              cursor: 'pointer',
              background: 'linear-gradient(135deg, #9B7BFF 0%, #7B5CE6 100%)',
              color: '#fff',
              fontSize: 13.5,
              fontWeight: 700,
              fontFamily: 'inherit',
              boxShadow:
                '0 6px 16px rgba(123,92,230,0.4), inset 0 1px 0 rgba(255,255,255,0.25)',
              transition: 'transform 160ms ease, filter 160ms ease',
            }}
          >
            Check
          </button>
        )}
      </div>
    </Glass>
  );
}

function DoneCircle() {
  return (
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: 12,
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${TOKENS.glassBorder}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name="check" size={18} color={TOKENS.textDim} strokeWidth={2.2} />
    </div>
  );
}

function Spinner() {
  return (
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: 12,
        background: 'rgba(155,123,255,0.10)',
        border: '1px solid rgba(155,123,255,0.30)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          border: '2px solid rgba(255,255,255,0.18)',
          borderTopColor: TOKENS.violet,
          animation: 'spin 0.85s linear infinite',
        }}
      />
    </div>
  );
}

// =====================================================
// Helpers
// =====================================================
function Label({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: 1.2,
        color: TOKENS.textMute,
        textTransform: 'uppercase',
      }}
    >
      {children}
    </div>
  );
}

function SkeletonBlock() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Skel h={88} />
      <Skel h={72} />
      <Skel h={72} />
      <Skel h={72} />
      <Skel h={72} />
    </div>
  );
}

function Skel({ h }: { h: number }) {
  return (
    <div
      style={{
        height: h,
        borderRadius: 14,
        background:
          'linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.08), rgba(255,255,255,0.04))',
        backgroundSize: '200% 100%',
        animation: 'pulse 1.6s ease infinite',
      }}
    />
  );
}

const retryBtnStyle = {
  marginTop: 12,
  height: 36,
  padding: '0 16px',
  borderRadius: 10,
  border: '1px solid rgba(155,123,255,0.4)',
  background: 'rgba(155,123,255,0.18)',
  color: '#fff',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
} as const;
