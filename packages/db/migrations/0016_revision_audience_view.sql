-- Resolve release and audience from current provenance, without one function call per candidate.
CREATE VIEW released_revision_audiences AS
WITH links AS (
 SELECT qs.revision_id,s.subject_id,true AS direct,
  s.review_status='approved' AND btrim(s.license)<>'' AS valid,
  CASE s.audience WHEN 'public' THEN 1 WHEN 'class' THEN 2 ELSE 3 END AS tier
 FROM question_sources qs JOIN sources s ON s.id=qs.source_id
 UNION ALL
 SELECT qa.revision_id,s.subject_id,false,
  btrim(a.license)<>'' AND (a.source_id IS NULL OR (s.review_status='approved' AND btrim(s.license)<>'')),
  CASE WHEN a.source_id IS NULL THEN NULL WHEN s.audience='public' THEN 1 WHEN s.audience='class' THEN 2 ELSE 3 END
 FROM question_assets qa JOIN assets a ON a.id=qa.asset_id
 LEFT JOIN sources s ON s.id=a.source_id
)
SELECT links.revision_id,q.subject_id,max(links.tier) AS minimum_tier
FROM links JOIN question_revisions r ON r.id=links.revision_id
JOIN questions q ON q.id=r.question_id
GROUP BY links.revision_id,q.subject_id
HAVING bool_or(links.direct)
 AND bool_and(COALESCE(links.valid,false) AND (links.subject_id IS NULL OR links.subject_id=q.subject_id));

ALTER VIEW released_revision_audiences OWNER TO migrator;
REVOKE ALL ON released_revision_audiences FROM PUBLIC;
GRANT SELECT ON released_revision_audiences TO app_rw;

CREATE OR REPLACE FUNCTION can_view_revision(rev uuid, subject uuid, viewer integer) RETURNS boolean
LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
 SELECT CASE
  WHEN viewer=3 THEN true
  WHEN viewer IS NULL OR viewer NOT IN (1,2) THEN false
  ELSE COALESCE((
   SELECT viewer>=minimum_tier FROM public.released_revision_audiences
   WHERE revision_id=rev AND subject_id=subject
  ),false) END;
$$;
