<?php
/**
 * Plugin Name:       AVDP Value Chain Enablers
 * Plugin URI:        https://www.avdp.org.sl/
 * Description:        Displays the AVDP Sierra Leone value-chain enablers — market access, access to finance, access to roads, business centres operating — plus field-outcome success highlights, via the [avdp_value_chains] shortcode.
 * Version:           1.0.0
 * Requires at least: 5.6
 * Requires PHP:      7.2
 * Author:            AVDP Sierra Leone — Monitoring & Evaluation
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       avdp-value-chains
 *
 * Mirrors the React dashboard's "Value Chain Enablers & Success" panel.
 * Figures are from the AVDP IFAD Supervision Mission deck (3 June 2026).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // No direct access.
}

define( 'AVDP_VC_VERSION', '1.0.0' );
define( 'AVDP_VC_URL', plugin_dir_url( __FILE__ ) );
define( 'AVDP_VC_PATH', plugin_dir_path( __FILE__ ) );

/**
 * Canonical data set for the value-chain enablers.
 *
 * Site owners can adjust the numbers without editing the plugin by hooking the
 * `avdp_value_chains_data` filter (e.g. in a child theme's functions.php), so
 * updating figures after the next supervision mission stays simple.
 *
 * @return array
 */
function avdp_vc_get_data() {
	$data = array(
		'heading'  => __( 'Value Chain Enablers & Success', 'avdp-value-chains' ),
		'tag'      => __( 'Market Access · Finance · Roads · Business Centres', 'avdp-value-chains' ),
		'pillars'  => array(
			array(
				'icon'  => 'handshake',
				'accent'=> 'teal',
				'label' => __( 'Market Access', 'avdp-value-chains' ),
				'value' => '8 / 12',
				'unit'  => __( 'commodity platforms (MSP)', 'avdp-value-chains' ),
				'sub'   => __( '16 of 24 provincial B2B events held', 'avdp-value-chains' ),
				'bar'   => 67,
			),
			array(
				'icon'  => 'finance',
				'accent'=> 'emerald',
				'label' => __( 'Access to Finance', 'avdp-value-chains' ),
				'value' => '200 / 300',
				'unit'  => __( 'private-sector partnerships', 'avdp-value-chains' ),
				'sub'   => __( 'Offtaker contracts & VSLA/cooperative pre-financing linkages', 'avdp-value-chains' ),
				'bar'   => 67,
			),
			array(
				'icon'  => 'route',
				'accent'=> 'amber',
				'label' => __( 'Access to Roads', 'avdp-value-chains' ),
				'value' => '401 / 420 km',
				'unit'  => __( 'feeder roads rehabilitated', 'avdp-value-chains' ),
				'sub'   => __( '+ 75 km farm tracks linking farms to markets', 'avdp-value-chains' ),
				'bar'   => 95,
			),
			array(
				'icon'  => 'building',
				'accent'=> 'sky',
				'label' => __( 'Business Centres Operating', 'avdp-value-chains' ),
				'value' => '23 / 40',
				'unit'  => __( 'ABC grain stores', 'avdp-value-chains' ),
				'sub'   => __( '+ 10 oil-palm processing hubs aggregating output', 'avdp-value-chains' ),
				'bar'   => 58,
			),
		),
		'success'  => array(
			array(
				'stat' => '56%',
				'text' => __( 'of FBOs reported increased production vs 2024', 'avdp-value-chains' ),
			),
			array(
				'stat' => '+47%',
				'text' => __( 'higher rice yields on AVDP-supported vs non-supported farms (2025)', 'avdp-value-chains' ),
			),
			array(
				'stat' => '64.1%',
				'text' => __( 'of households reported an increase in production', 'avdp-value-chains' ),
			),
		),
	);

	/**
	 * Filter the value-chain enabler data before rendering.
	 *
	 * @param array $data The full data set (heading, tag, pillars, success).
	 */
	return apply_filters( 'avdp_value_chains_data', $data );
}

/**
 * Return a small inline SVG icon (no external icon library required).
 *
 * @param string $name Icon key.
 * @return string SVG markup.
 */
function avdp_vc_icon( $name ) {
	$attrs = 'width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"';
	$paths = array(
		'handshake' => '<path d="m11 17 2 2a1 1 0 1 0 3-3"/><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4"/><path d="m21 3 1 11h-2"/><path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3"/><path d="M3 4h8"/>',
		'finance'   => '<line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
		'route'     => '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
		'building'  => '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>',
		'trending'  => '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
	);

	$path = isset( $paths[ $name ] ) ? $paths[ $name ] : $paths['trending'];

	return '<svg ' . $attrs . '>' . $path . '</svg>';
}

/**
 * Render the [avdp_value_chains] shortcode.
 *
 * Attributes:
 *   theme="dark|light"  Colour scheme (default: dark).
 *
 * @param array $atts Shortcode attributes.
 * @return string HTML.
 */
function avdp_vc_render_shortcode( $atts ) {
	$atts = shortcode_atts(
		array(
			'theme' => 'dark',
		),
		$atts,
		'avdp_value_chains'
	);

	wp_enqueue_style( 'avdp-value-chains' );

	$data  = avdp_vc_get_data();
	$theme = ( 'light' === $atts['theme'] ) ? 'avdpvc--light' : 'avdpvc--dark';

	ob_start();
	?>
	<section class="avdpvc <?php echo esc_attr( $theme ); ?>">
		<div class="avdpvc__head">
			<div class="avdpvc__title">
				<span class="avdpvc__title-icon"><?php echo avdp_vc_icon( 'trending' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped — static SVG. ?></span>
				<h3><?php echo esc_html( $data['heading'] ); ?></h3>
			</div>
			<span class="avdpvc__tag"><?php echo esc_html( $data['tag'] ); ?></span>
		</div>

		<div class="avdpvc__grid">
			<?php foreach ( $data['pillars'] as $p ) :
				$accent = isset( $p['accent'] ) ? $p['accent'] : 'teal';
				$bar    = max( 0, min( 100, (int) $p['bar'] ) );
				?>
				<div class="avdpvc__card avdpvc__card--<?php echo esc_attr( $accent ); ?>">
					<div class="avdpvc__card-head">
						<span class="avdpvc__card-icon"><?php echo avdp_vc_icon( $p['icon'] ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped — static SVG. ?></span>
						<span class="avdpvc__card-label"><?php echo esc_html( $p['label'] ); ?></span>
					</div>
					<div class="avdpvc__card-value"><?php echo esc_html( $p['value'] ); ?></div>
					<div class="avdpvc__card-unit"><?php echo esc_html( $p['unit'] ); ?></div>
					<div class="avdpvc__bar" role="progressbar" aria-valuenow="<?php echo esc_attr( $bar ); ?>" aria-valuemin="0" aria-valuemax="100">
						<span class="avdpvc__bar-fill" style="width: <?php echo esc_attr( $bar ); ?>%"></span>
					</div>
					<p class="avdpvc__card-sub"><?php echo esc_html( $p['sub'] ); ?></p>
				</div>
			<?php endforeach; ?>
		</div>

		<?php if ( ! empty( $data['success'] ) ) : ?>
			<div class="avdpvc__success">
				<?php foreach ( $data['success'] as $s ) : ?>
					<div class="avdpvc__success-item">
						<span class="avdpvc__success-stat"><?php echo esc_html( $s['stat'] ); ?></span>
						<span class="avdpvc__success-text"><?php echo esc_html( $s['text'] ); ?></span>
					</div>
				<?php endforeach; ?>
			</div>
		<?php endif; ?>
	</section>
	<?php
	return ob_get_clean();
}

/**
 * Register assets and the shortcode.
 */
function avdp_vc_init() {
	wp_register_style(
		'avdp-value-chains',
		AVDP_VC_URL . 'assets/avdp-value-chains.css',
		array(),
		AVDP_VC_VERSION
	);

	add_shortcode( 'avdp_value_chains', 'avdp_vc_render_shortcode' );
}
add_action( 'init', 'avdp_vc_init' );
