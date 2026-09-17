// Landing-page section components for the substation risk simulator.
// Pure presentational components (plus one scroll-reveal effect hook).
// All copy comes from props; no imports/exports (shared global scope).

function SiteTicker({ items }) {
  return (
    <div className="ticker" role="region" aria-label="Live results">
      <div className="ticker-track">
        {items.map((text, i) => (
          <span className="ticker-item" key={"ticker-a-" + i}>
            {text}
          </span>
        ))}
        <span className="ticker-copy" aria-hidden="true">
          {items.map((text, i) => (
            <span className="ticker-item" key={"ticker-b-" + i}>
              {text}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}

function SiteSplit({
  id,
  tone,
  flip,
  eyebrow,
  heading,
  image,
  linkHref,
  linkLabel = "Know More",
  children,
}) {
  const titleId = id + "-title";
  return (
    <section
      className={"split split-" + tone + (flip ? " split-flip" : "")}
      id={id}
      aria-labelledby={titleId}
    >
      <div className="split-inner">
        <figure className="split-media">
          <div className="media-frame">
            <img
              src={image.src}
              alt={image.alt}
              width={image.width}
              height={image.height}
              loading="lazy"
              decoding="async"
            />
          </div>
          {image.caption ? (
            <figcaption className="media-caption">{image.caption}</figcaption>
          ) : null}
        </figure>
        <div className="split-copy reveal">
          <p className="eyebrow">{eyebrow}</p>
          <h2 className="split-heading" id={titleId}>
            {heading}
          </h2>
          <div className="split-text">{children}</div>
          <a className="pill-link" href={linkHref}>
            <span>{linkLabel}</span>
            <span className="pill-link-arrow" aria-hidden="true">
              →
            </span>
          </a>
        </div>
      </div>
    </section>
  );
}

function SiteBand({ bigText, stats }) {
  return (
    <section className="band" aria-labelledby="band-title">
      <h2 className="sr" id="band-title">
        Key results
      </h2>
      <p className="band-bigtext" aria-hidden="true">
        {bigText}
      </p>
      <div className="band-panel">
        <ul className="kpis">
          {stats.map((s, i) => (
            <li className="kpi reveal" key={"kpi-" + i}>
              <span className="kpi-value">{s.value}</span>
              <span className="kpi-label">{s.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function SiteNotes({ notes, caseStudyUrl }) {
  return (
    <section className="notes" id="notes" aria-labelledby="notes-title">
      <div className="notes-head">
        <p className="eyebrow">Engineering notes</p>
        <h2 className="notes-title" id="notes-title">
          What broke, and what fixed it
        </h2>
        <p className="notes-sub">
          Four real problems from building this simulator, with the
          measurement that confirmed each fix.
        </p>
      </div>
      <ul className="notes-list">
        {notes.map((n, i) => (
          <li className="note reveal" key={"note-" + i}>
            <div className="note-metric">
              <span className="note-metric-value">{n.metric}</span>
              <span className="note-metric-label">{n.metricLabel}</span>
            </div>
            <h3 className="note-title">{n.title}</h3>
            <p className="note-body">
              <strong>Problem.</strong> {n.problem}
            </p>
            <p className="note-body">
              <strong>Fix.</strong> {n.fix}
            </p>
            {n.commit ? (
              <p className="note-commit">
                Commit <code>{n.commit}</code>
              </p>
            ) : null}
          </li>
        ))}
      </ul>
      <a
        className="pill-link"
        href={caseStudyUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        <span>Read the case study</span>
        <span className="pill-link-arrow" aria-hidden="true">
          →
        </span>
      </a>
    </section>
  );
}

function SiteCta({ title, text, primary, secondary }) {
  return (
    <section className="cta-wrap" aria-labelledby="cta-title">
      <div className="cta-card">
        <div className="grain" aria-hidden="true"></div>
        <h2 className="cta-title" id="cta-title">
          {title}
        </h2>
        <p className="cta-text">{text}</p>
        <div className="cta-actions">
          <a className="btn-dark" href={primary.href}>
            {primary.label}
          </a>
          <a
            className="btn-ghost-dark"
            href={secondary.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            {secondary.label}
          </a>
        </div>
      </div>
    </section>
  );
}

function SiteCredit({ name, role, linkedin, github }) {
  return (
    <section className="credit" aria-labelledby="credit-title">
      <div className="credit-inner">
        <div>
          <p className="eyebrow">Designed and built by</p>
          <h2 className="credit-name" id="credit-title">
            {name}
          </h2>
          <p className="credit-role">{role}</p>
        </div>
        <div className="credit-links">
          <a
            className="pill-link"
            href={linkedin}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>LinkedIn</span>
            <span className="pill-link-arrow" aria-hidden="true">
              ↗
            </span>
          </a>
          <a
            className="pill-link"
            href={github}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>GitHub</span>
            <span className="pill-link-arrow" aria-hidden="true">
              ↗
            </span>
          </a>
        </div>
      </div>
    </section>
  );
}

function SiteFooter({ name }) {
  return (
    <footer className="site-foot">
      <ArtSkyline className="foot-art" />
      <div className="foot-row">
        <span>© 2026 {name}</span>
        <span>Monte Carlo cost and schedule risk simulator</span>
        <a href="#top">Back to top</a>
      </div>
    </footer>
  );
}

function SiteReveal() {
  React.useEffect(() => {
    const elements = Array.from(document.querySelectorAll(".reveal"));

    const reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion || typeof IntersectionObserver === "undefined") {
      elements.forEach((el) => el.classList.add("is-in"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
    );

    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return null;
}
