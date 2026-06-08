=== AVDP Value Chain Enablers ===
Contributors: avdp
Tags: agriculture, dashboard, value-chains, sierra-leone, ifad
Requires at least: 5.6
Tested up to: 6.5
Requires PHP: 7.2
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Displays the AVDP Sierra Leone value-chain enablers — market access, access to
finance, access to roads, and business centres operating — plus field-outcome
success highlights, as a styled panel.

== Description ==

This plugin renders the "Value Chain Enablers & Success" panel from the AVDP
Sierra Leone Monitoring & Evaluation dashboard directly inside WordPress.

It is self-contained: no external services, APIs, or icon libraries are
required, and it works offline. Figures are from the AVDP IFAD Supervision
Mission deck (3 June 2026).

The panel shows four enabler pillars:

* **Market Access** — commodity (MSP) platforms and provincial B2B events
* **Access to Finance** — private-sector partnerships, offtaker & VSLA linkages
* **Access to Roads** — feeder roads rehabilitated and farm tracks
* **Business Centres Operating** — ABC grain stores and oil-palm processing hubs

...followed by a success-highlight strip of field outcome statistics.

== Usage ==

Place the shortcode on any page, post, or widget:

    [avdp_value_chains]

Optional attribute:

    [avdp_value_chains theme="light"]

`theme` accepts `dark` (default, matches the dashboard) or `light`.

== Customising the figures ==

To update the numbers without editing the plugin, hook the
`avdp_value_chains_data` filter from a child theme's functions.php:

    add_filter( 'avdp_value_chains_data', function ( $data ) {
        $data['pillars'][2]['value'] = '420 / 420 km';
        $data['pillars'][2]['bar']   = 100;
        return $data;
    } );

== Installation ==

1. In WordPress admin, go to Plugins → Add New → Upload Plugin.
2. Upload the avdp-value-chains.zip file and click Install Now.
3. Activate the plugin.
4. Add the [avdp_value_chains] shortcode to a page or post.

== Changelog ==

= 1.0.0 =
* Initial release: [avdp_value_chains] shortcode with dark/light themes.
