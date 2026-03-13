import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

const baseUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "https://openverein.eu";

export const OpenVereinLayout = ({
  children,
}: {
  children: React.ReactNode;
}) => (
  <Html>
    <Head />
    <Tailwind
      config={{
        darkMode: "class",
      }}
    >
      <Body className="bg-white font-sans">
        <Preview>The Unified Management Platform for your Organization</Preview>
        <Container className="mx-auto py-5 pb-12">
          <Img
            src={`${baseUrl}/icon.svg`}
            width="170"
            height="50"
            alt="OpenVerein"
            className="mx-auto"
          />
          {children}
          <Hr className="border-[#cccccc] my-5" />
          <Text className="text-[#8898aa] text-[12px]">
            https://github.com/Chaoscaot/OpenVerein
          </Text>
        </Container>
      </Body>
    </Tailwind>
  </Html>
);

OpenVereinLayout.PreviewProps = {
  children: <h1>Hello, World!</h1>,
};

export default OpenVereinLayout;
