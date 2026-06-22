import React from 'react';
import { Icon } from './Icon.tsx';

interface UpcomingFeatureProps {
  title: string;
  description: string;
  iconName?: React.ComponentProps<typeof Icon>['name'];
}

export function UpcomingFeature({ title, description, iconName = 'info' }: UpcomingFeatureProps) {
  return (
    <div
      className="screen-anim"
      style={{ 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center',
        minHeight: '70vh',
        textAlign: 'center',
        padding: '0 var(--page-x)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Ambient Branded Stage Glow */}
      <div 
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '45vw',
          height: '45vw',
          maxWidth: 500,
          maxHeight: 500,
          background: 'radial-gradient(circle, var(--accent-soft) 0%, transparent 65%)',
          filter: 'blur(80px)',
          opacity: 0.6,
          zIndex: -1,
          animation: 'pulse-badge 4s ease-in-out infinite alternate',
        }}
      />

      {/* Hero Icon Container with Glass & Mechanical Ring */}
      <div style={{ position: 'relative', marginBottom: 48 }}>
        {/* Outer rotating dashed ring for creative/building flair */}
        <div 
          style={{
            position: 'absolute',
            inset: -14,
            borderRadius: '50%',
            border: '1px dashed var(--accent)',
            opacity: 0.35,
            animation: 'spin 24s linear infinite',
          }}
        />
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes float-up {
            0% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
            100% { transform: translateY(0); }
          }
        `}</style>
        
        {/* Inner Glass Icon */}
        <div 
          style={{
            width: 104,
            height: 104,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.01))',
            border: '1px solid var(--accent-line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'inset 0 0 30px var(--accent-soft), 0 30px 60px -15px rgba(0,0,0,0.9)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            animation: 'float-up 6s ease-in-out infinite',
          }}
        >
          <Icon name={iconName} size={46} style={{ color: 'var(--accent)' }} />
        </div>
      </div>
      
      {/* Branded Typography */}
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <p 
          className="kicker" 
          style={{ 
            color: 'var(--accent)', 
            marginBottom: 16, 
            letterSpacing: '0.25em',
            fontSize: 13,
            textTransform: 'uppercase'
          }}
        >
          Coming Soon
        </p>
        <h1 
          className="display" 
          style={{ 
            fontSize: 'clamp(36px, 5vw, 56px)', 
            marginBottom: 24,
            letterSpacing: '-0.02em',
            background: 'linear-gradient(180deg, #ffffff 20%, var(--accent) 150%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow: '0 20px 40px rgba(227, 189, 118, 0.15)'
          }}
        >
          {title}
        </h1>
      </div>
      
      <p 
        style={{ 
          color: 'var(--text-dim)', 
          fontSize: 'clamp(16px, 1.5vw, 18px)', 
          maxWidth: 520, 
          lineHeight: 1.65,
          fontWeight: 400
        }}
      >
        {description}
      </p>
    </div>
  );
}
