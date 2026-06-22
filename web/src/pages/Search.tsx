import { UpcomingFeature } from '../components/ui/UpcomingFeature.tsx';

export default function Search() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingTop: 84 }}>
      <div className="grain" aria-hidden="true" />
      <UpcomingFeature 
        title="Search is Upcoming" 
        description="We are currently building an advanced search engine with mood-matching and deep genre filtering. This feature will be available in the next release of the MVP."
        iconName="search"
      />
    </div>
  );
}
