package transcoder

import "testing"

func TestLadderForSourceHeight(t *testing.T) {
	tests := []struct {
		name         string
		sourceWidth  int
		sourceHeight int
		wantNames    []string
		wantSizes    []struct{ width, height int }
	}{
		{
			name:         "1080p source keeps base ladder",
			sourceWidth:  1920,
			sourceHeight: 1080,
			wantNames:    []string{"360p", "480p", "720p", "1080p"},
			wantSizes: []struct{ width, height int }{
				{0, 360}, {0, 480}, {0, 720}, {0, 1080},
			},
		},
		{
			name:         "2K source adds native 2K rung",
			sourceWidth:  2048,
			sourceHeight: 1080,
			wantNames:    []string{"360p", "480p", "720p", "1080p", "2048x1080"},
			wantSizes: []struct{ width, height int }{
				{0, 360}, {0, 480}, {0, 720}, {0, 1080}, {2048, 1080},
			},
		},
		{
			name:         "4K source adds native 4K rung",
			sourceWidth:  3840,
			sourceHeight: 2160,
			wantNames:    []string{"360p", "480p", "720p", "1080p", "3840x2160"},
			wantSizes: []struct{ width, height int }{
				{0, 360}, {0, 480}, {0, 720}, {0, 1080}, {3840, 2160},
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			ladder := LadderForSourceDimensions(tc.sourceWidth, tc.sourceHeight)
			if len(ladder) != len(tc.wantNames) {
				t.Fatalf("len(ladder) = %d, want %d", len(ladder), len(tc.wantNames))
			}
			for i, rendition := range ladder {
				if rendition.Name != tc.wantNames[i] {
					t.Fatalf("rendition %d name = %q, want %q", i, rendition.Name, tc.wantNames[i])
				}
				if rendition.Width != tc.wantSizes[i].width || rendition.Height != tc.wantSizes[i].height {
					t.Fatalf("rendition %d size = %dx%d, want %dx%d", i, rendition.Width, rendition.Height, tc.wantSizes[i].width, tc.wantSizes[i].height)
				}
			}
		})
	}
}

func TestLadderForSourceDimensionsIgnoresMissingDurationMetadata(t *testing.T) {
	ladder := LadderForSourceDimensions(3840, 2160)
	if len(ladder) != 5 {
		t.Fatalf("len(ladder) = %d, want 5", len(ladder))
	}
	last := ladder[len(ladder)-1]
	if last.Width != 3840 || last.Height != 2160 {
		t.Fatalf("top rung = %dx%d, want 3840x2160", last.Width, last.Height)
	}
	if last.Name != "3840x2160" {
		t.Fatalf("top rung name = %q, want %q", last.Name, "3840x2160")
	}
}
