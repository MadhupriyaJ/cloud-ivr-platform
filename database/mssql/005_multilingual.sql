-- Multilingual IVR: which languages a domain's callers may use.
--
-- Domains.SupportedLanguages is a comma-separated list of language names,
-- e.g. 'English, Tamil'. NULL or empty means "any language": the assistant
-- answers in whatever language the caller speaks. DefaultLanguage stays the
-- language of the opening greeting.
--
-- Safe to re-run.

IF COL_LENGTH('dbo.Domains', 'SupportedLanguages') IS NULL
  ALTER TABLE dbo.Domains ADD SupportedLanguages NVARCHAR(200) NULL;
GO

-- The hospital demo serves Tamil Nadu callers: English and Tamil, including
-- the mixed "Tanglish" most callers actually speak.
UPDATE dbo.Domains
SET SupportedLanguages = N'English, Tamil'
WHERE DomainCode IN ('hospital', 'hospital-management')
  AND (SupportedLanguages IS NULL OR SupportedLanguages = N'');
GO
