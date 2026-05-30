import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

export type ClubInvitationEmailProps = {
  kind: "player" | "staff";
  clubName: string;
  inviterName: string | null;
  roleName: string | null;
  playerName: string | null;
  teamName: string | null;
  acceptUrl: string;
  expiresAtIso: string;
  brandColor: string;
  copy: {
    preview: string;
    heading: string;
    intro: string;
    detail: string;
    cta: string;
    expiry: string;
    fallbackLabel: string;
    securityNote: string;
    footer: string;
  };
};

export function ClubInvitationEmail({
  clubName,
  acceptUrl,
  brandColor,
  copy,
}: ClubInvitationEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{copy.preview}</Preview>
      <Tailwind>
        <Body className="bg-zinc-50 font-sans">
          <Container className="mx-auto my-10 max-w-[520px] rounded-lg bg-white p-8 shadow-sm">
            <Section>
              <Heading className="m-0 text-xl font-semibold text-zinc-900">
                {copy.heading}
              </Heading>
              <Text className="mt-3 text-sm leading-6 text-zinc-700">
                {copy.intro}
              </Text>
              <Text className="mt-2 text-sm leading-6 text-zinc-700">
                {copy.detail}
              </Text>
            </Section>

            <Section className="mt-6">
              <Button
                href={acceptUrl}
                style={{
                  backgroundColor: brandColor,
                  color: "#ffffff",
                  padding: "12px 20px",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                {copy.cta}
              </Button>
              <Text className="mt-3 text-xs text-zinc-500">{copy.expiry}</Text>
            </Section>

            <Hr className="my-6 border-zinc-200" />

            <Section>
              <Text className="m-0 text-xs text-zinc-500">
                {copy.fallbackLabel}
              </Text>
              <Link
                href={acceptUrl}
                className="text-xs text-zinc-700 underline"
                style={{ wordBreak: "break-all" }}
              >
                {acceptUrl}
              </Link>
            </Section>

            <Section className="mt-6">
              <Text className="text-xs text-zinc-500">{copy.securityNote}</Text>
              <Text className="mt-4 text-xs text-zinc-400">
                {copy.footer.replace("{club}", clubName)}
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

export default ClubInvitationEmail;
