/** @type {import('next').NextConfig} */

/**
 * Politica de conteudo.
 *
 * O Next injeta estilos e scripts inline nas paginas, por isso 'unsafe-inline'
 * continua no style-src e no script-src — tirar quebra a hidratacao. O que ela
 * fecha de verdade: de onde pode vir script, para onde a pagina pode enviar
 * dados (`connect-src`) e quem pode embutir o site (`frame-ancestors`), que e
 * o que barra clickjacking em cima do painel.
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self'",
  "form-action 'self' https://checkout.infinitepay.io",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Impede o site de ser colocado dentro de um iframe alheio.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Nao vaza a URL do pedido (que contem o codigo) para sites de terceiros.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // HTTPS obrigatorio por 2 anos, inclusive nos subdominios.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig = {
  // Nao anuncia "X-Powered-By: Next.js" para quem estiver catalogando alvos.
  poweredByHeader: false,
  // Source map em producao entregaria o codigo do servidor mastigado.
  productionBrowserSourceMaps: false,

  images: {
    // O otimizador busca a imagem pelo servidor. Aberto em "**", ele vira um
    // proxy que qualquer um usa para buscar qualquer URL pela nossa conta.
    // Aqui so entram imagens do proprio site e do storage da Vercel.
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "robertao.vercel.app" },
      { protocol: "https", hostname: "robertaopremiacoes.com.br" },
      { protocol: "https", hostname: "www.robertaopremiacoes.com.br" },
    ],
    dangerouslyAllowSVG: false,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  /**
   * O endereco da Vercel manda para o dominio proprio.
   *
   * Dois enderecos servindo o mesmo site fazem o Google dividir a relevancia
   * entre eles. O 308 e permanente, que e o que diz ao buscador qual dos dois
   * vale — um redirecionamento temporario nao consolidaria nada.
   *
   * Casa so com o host exato: as URLs de preview (robertao-<hash>-...) nao
   * batem, entao continuam abrindo o deploy que estao testando.
   */
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "robertao.vercel.app" }],
        destination: "https://robertaopremiacoes.com.br/:path*",
        permanent: true,
      },
    ];
  },

  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // O painel nunca deve ser guardado em cache de navegador ou de CDN.
      {
        source: "/admin/:path*",
        headers: [
          ...securityHeaders,
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, private" },
        ],
      },
      // Respostas de API carregam dado de pedido; fora do cache tambem.
      {
        source: "/api/:path*",
        headers: [
          ...securityHeaders,
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, private" },
        ],
      },
    ];
  },
};

export default nextConfig;
