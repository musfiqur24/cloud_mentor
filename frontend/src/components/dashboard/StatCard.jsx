import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';

const trendIcons = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  neutral: Minus
};

function StatCard({
  label,
  value,
  hint,
  trend,
  icon: Icon,
  tone = 'default',
  onClick,
  className = ''
}) {
  const resolvedTrend = typeof trend === 'string' ? { label: trend } : trend;
  const TrendIcon = trendIcons[resolvedTrend?.direction] || Minus;
  const CardElement = onClick ? 'button' : 'article';
  const cardClassName = [
    'stat-card',
    tone !== 'default' ? `stat-card--${tone}` : '',
    onClick ? 'stat-card--interactive' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <CardElement
      {...(onClick ? { type: 'button', onClick } : {})}
      className={cardClassName}
    >
      <div className="stat-card__header">
        <span>{label}</span>
        {Icon && (
          <span className="stat-card__icon" aria-hidden="true">
            <Icon size={20} />
          </span>
        )}
      </div>

      <strong className="stat-card__value">{value}</strong>

      {(hint || resolvedTrend?.label) && (
        <div className="stat-card__footer">
          {resolvedTrend?.label && (
            <span className={`stat-card__trend ${resolvedTrend.direction ? `is-${resolvedTrend.direction}` : ''}`}>
              <TrendIcon size={15} aria-hidden="true" />
              {resolvedTrend.label}
            </span>
          )}
          {hint && <span className="stat-card__hint">{hint}</span>}
        </div>
      )}
    </CardElement>
  );
}

export default StatCard;
